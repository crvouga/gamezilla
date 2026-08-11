/**
 * AuthBridge helpers: identity refresh + anon ensure with retries.
 */

import type { Timers } from '@pkgs/clock';
import type { HttpFetch } from '@pkgs/http-client';
import type { SecureStorageStore } from '@pkgs/secure-storage/secure-storage-store';
import { writeSecureStorageItem } from '@pkgs/secure-storage/use-secure-storage-item';

import { LAST_LOCAL_ACCOUNT_ID_KEY } from './auth-storage-keys';
import { collectDeviceSnapshot } from './collect-device-snapshot';
import { ensureAnonAuth } from './ensure-anon-auth-fetch';
import { refreshAuth } from './refresh-auth-fetch';
import { shouldBindAnonUserAfterEnsure } from './resolve-client-identity';
import { SessionCapabilityStore } from './session-capability';

export type AuthBridgeLogger = {
  info: (msg: string, meta?: Record<string, unknown>) => void;
  warn: (msg: string, meta?: Record<string, unknown>) => void;
  error: (msg: string, meta?: Record<string, unknown>) => void;
};

export type AuthBridgeRefreshDeps = {
  apiUrl: string;
  deviceId: string;
  fetchFn: HttpFetch;
  store: SecureStorageStore;
  log: AuthBridgeLogger;
  timers: Timers;
  lastSyncedTokenRef: { current: string | null };
  inFlightRef: { current: boolean };
  pendingTokenRef: { current: string | null };
};

const ANON_ENSURE_RETRY_DELAYS_MS = [500, 1500, 3000] as const;

async function sleepMs(ms: number, timers: Timers): Promise<void> {
  await new Promise<void>((resolve) => {
    timers.setTimeout(resolve, ms);
  });
}

export class AuthBridgeRefresh {
  constructor(private readonly deps: AuthBridgeRefreshDeps) {}

  private session(): SessionCapabilityStore {
    return new SessionCapabilityStore(this.deps.store);
  }

  async applyRefreshSuccess(args: {
    readonly token: string;
    readonly accountId: string;
    readonly expiresAt: string | null;
    readonly externalUserId: string | null;
  }): Promise<void> {
    const { token, accountId, expiresAt, externalUserId } = args;
    const session = this.session();
    if (session.readToken() !== token) return;
    await session.write({ token, expiresAt, externalUserId });
    await writeSecureStorageItem(
      this.deps.store,
      LAST_LOCAL_ACCOUNT_ID_KEY,
      accountId
    );
    if (session.readToken() !== token) {
      await writeSecureStorageItem(
        this.deps.store,
        LAST_LOCAL_ACCOUNT_ID_KEY,
        null
      );
      return;
    }
    this.deps.lastSyncedTokenRef.current = token;
  }

  async runRefresh(args: {
    token: string;
    expiresAt: string | null;
    externalUserId: string | null;
    force: boolean;
  }): Promise<void> {
    const { token, force, expiresAt, externalUserId } = args;
    if (!force && this.deps.lastSyncedTokenRef.current === token) return;
    if (this.deps.inFlightRef.current) {
      this.deps.pendingTokenRef.current = token;
      return;
    }
    this.deps.inFlightRef.current = true;
    this.deps.pendingTokenRef.current = null;
    try {
      const session = this.session();
      await session.write({ token, expiresAt, externalUserId });
      const { accountId } = await refreshAuth({
        apiUrl: this.deps.apiUrl,
        bearerToken: token,
        deviceId: this.deps.deviceId,
        fetchFn: this.deps.fetchFn,
        deviceSnapshot: collectDeviceSnapshot(),
      });
      const currentToken = session.readToken();
      if (currentToken !== token) {
        this.discardStaleRefresh(currentToken);
        return;
      }
      await this.applyRefreshSuccess({
        token,
        accountId,
        expiresAt,
        externalUserId,
      });
    } catch (e) {
      this.deps.log.error('auth/refresh failed', {
        error: e instanceof Error ? e.message : String(e),
      });
    } finally {
      this.deps.inFlightRef.current = false;
      await this.retryPendingRefresh({ expiresAt, externalUserId });
    }
  }

  async handleSignedOut(): Promise<void> {
    this.deps.lastSyncedTokenRef.current = null;
    this.deps.pendingTokenRef.current = null;
    try {
      await this.session().clear();
    } catch (e) {
      this.deps.log.warn('clear session capability failed', {
        error: e instanceof Error ? e.message : String(e),
      });
    }
    try {
      const hadUser =
        typeof this.deps.store.getValue(LAST_LOCAL_ACCOUNT_ID_KEY) === 'string';
      const userId = await this.ensureAnonUserWithRetries();
      if (!shouldBindAnonUserAfterEnsure(this.session().readToken())) {
        this.deps.log.info('anon ensure discarded; session token present');
        return;
      }
      await writeSecureStorageItem(
        this.deps.store,
        LAST_LOCAL_ACCOUNT_ID_KEY,
        userId
      );
      if (!hadUser) {
        this.deps.log.info('anon user ensured', { userId });
      }
    } catch (e) {
      this.deps.log.error('auth/anon/ensure failed', {
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  private discardStaleRefresh(currentToken: string | null): void {
    this.deps.log.info(
      'auth/refresh discarded; session token changed during request'
    );
    if (currentToken !== null) {
      this.deps.pendingTokenRef.current = currentToken;
    }
  }

  private async retryPendingRefresh(meta: {
    readonly expiresAt: string | null;
    readonly externalUserId: string | null;
  }): Promise<void> {
    const pending = this.deps.pendingTokenRef.current;
    this.deps.pendingTokenRef.current = null;
    if (pending === null || pending === this.deps.lastSyncedTokenRef.current) {
      return;
    }
    await this.runRefresh({
      token: pending,
      expiresAt: meta.expiresAt,
      externalUserId: meta.externalUserId,
      force: true,
    });
  }

  private async ensureAnonUserWithRetries(): Promise<string> {
    let lastError: unknown;
    for (
      let attempt = 0;
      attempt <= ANON_ENSURE_RETRY_DELAYS_MS.length;
      attempt++
    ) {
      try {
        const { userId } = await ensureAnonAuth({
          apiUrl: this.deps.apiUrl,
          deviceId: this.deps.deviceId,
          fetchFn: this.deps.fetchFn,
          forceNew: false,
        });
        return userId;
      } catch (e) {
        lastError = e;
        const delay = ANON_ENSURE_RETRY_DELAYS_MS[attempt];
        if (delay === undefined) break;
        this.deps.log.warn('auth/anon/ensure failed; retrying', {
          attempt: attempt + 1,
          error: e instanceof Error ? e.message : String(e),
        });
        await sleepMs(delay, this.deps.timers);
      }
    }
    throw lastError instanceof Error ? lastError : new Error(String(lastError));
  }
}
