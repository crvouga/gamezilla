/**
 * AuthBridge helpers: identity refresh + anon ensure with retries.
 */

import type { Timers } from '@pkgs/clock';
import type { HttpFetch } from '@pkgs/http-client';
import { HttpNetworkError } from '@pkgs/http-client';
import type { SecureStorageStore } from '@pkgs/secure-storage/secure-storage-store';
import { writeSecureStorageItem } from '@pkgs/secure-storage/use-secure-storage-item';
import type { CreateId } from '@pkgs/uuid';

import { LAST_LOCAL_ACCOUNT_ID_KEY } from '../../public/auth-storage-keys';
import { shouldBindAnonUserAfterEnsure } from '../../public/resolve-client-identity';
import { SessionCapabilityStore } from '../../public/session-capability';
import { collectDeviceSnapshot } from './collect-device-snapshot';
import { ensureAnonAuth } from './ensure-anon-auth-fetch';
import { isUnauthorizedRefreshError, refreshAuth } from './refresh-auth-fetch';

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
  createId: CreateId;
  lastSyncedTokenRef: { current: string | null };
  inFlightRef: { current: boolean };
  pendingTokenRef: { current: string | null };
  waitUntilAvailable?: (signal?: AbortSignal | null) => Promise<void>;
};

function readStoredAccountId(store: SecureStorageStore): string | null {
  const value = store.getValue(LAST_LOCAL_ACCOUNT_ID_KEY);
  return typeof value === 'string' && value.length > 0 ? value : null;
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
      // Dead bearer + cold BA null skips signed-out clear
      // (`shouldClearCapabilityOnBaSignedOut`). Without this fallthrough,
      // `lastLocalAccountId` never binds and SyncEngineBoot never paints.
      if (isUnauthorizedRefreshError(e)) {
        await this.handleSignedOut({ rotateAccount: true });
        return;
      }
    } finally {
      this.deps.inFlightRef.current = false;
      await this.retryPendingRefresh({ expiresAt, externalUserId });
    }
  }

  /**
   * Cold start with no session token: persist a local account id immediately
   * so SQLite can open, then reconcile with `/identity/anon/ensure`.
   */
  async bindLocalAccountThenEnsure(): Promise<void> {
    if (this.session().readToken() !== null) return;
    const previous = readStoredAccountId(this.deps.store);
    const localId = previous ?? this.deps.createId();
    if (previous === null) {
      await writeSecureStorageItem(
        this.deps.store,
        LAST_LOCAL_ACCOUNT_ID_KEY,
        localId
      );
    }
    await this.ensureAndMaybeAdopt({
      localId,
      adoptDifferentRemote: previous === null,
    });
  }

  async handleSignedOut(args?: {
    readonly rotateAccount?: boolean;
  }): Promise<void> {
    this.deps.lastSyncedTokenRef.current = null;
    this.deps.pendingTokenRef.current = null;
    try {
      await this.session().clear();
    } catch (e) {
      this.deps.log.warn('clear session capability failed', {
        error: e instanceof Error ? e.message : String(e),
      });
    }
    if (args?.rotateAccount === true) {
      const localId = this.deps.createId();
      await writeSecureStorageItem(
        this.deps.store,
        LAST_LOCAL_ACCOUNT_ID_KEY,
        localId
      );
      await this.ensureAndMaybeAdopt({
        localId,
        adoptDifferentRemote: true,
      });
      return;
    }
    await this.bindLocalAccountThenEnsure();
  }

  private async ensureAndMaybeAdopt(args: {
    readonly localId: string;
    readonly adoptDifferentRemote: boolean;
  }): Promise<void> {
    try {
      const userId = await this.ensureAnonUserWithRetries(args.localId);
      if (!shouldBindAnonUserAfterEnsure(this.session().readToken())) {
        this.deps.log.info('anon ensure discarded; session token present');
        return;
      }
      if (userId === args.localId) return;
      if (!args.adoptDifferentRemote) {
        this.deps.log.info('anon ensure kept local account id', {
          localId: args.localId,
          userId,
        });
        return;
      }
      await writeSecureStorageItem(
        this.deps.store,
        LAST_LOCAL_ACCOUNT_ID_KEY,
        userId
      );
    } catch (e) {
      if (e instanceof HttpNetworkError) return;
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

  private async ensureAnonUserWithRetries(userId: string): Promise<string> {
    while (true) {
      try {
        const result = await ensureAnonAuth({
          apiUrl: this.deps.apiUrl,
          deviceId: this.deps.deviceId,
          fetchFn: this.deps.fetchFn,
          forceNew: false,
          userId,
        });
        return result.userId;
      } catch (e) {
        if (!(e instanceof HttpNetworkError)) throw e;
        if (this.deps.waitUntilAvailable === undefined) throw e;
        await this.deps.waitUntilAvailable();
      }
    }
  }
}
