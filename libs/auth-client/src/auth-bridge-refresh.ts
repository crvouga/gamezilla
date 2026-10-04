/**
 * AuthBridge helpers: identity refresh + anon ensure with retries.
 */

import { LAST_LOCAL_ACCOUNT_ID_KEY } from '@libs/auth-shared/auth-storage-keys';
import { ensureAnonAuth } from '@libs/auth-shared/ensure-anon-auth-fetch';
import {
  isUnauthorizedRefreshError,
  refreshAuth,
} from '@libs/auth-shared/refresh-auth-fetch';
import { shouldBindAnonUserAfterEnsure } from '@libs/auth-shared/resolve-client-identity';
import { SessionCapabilityStore } from '@libs/auth-shared/session-capability';
import type { Timers } from '@pkgs/clock-shared/types';
import { HttpNetworkError } from '@pkgs/http-client-shared/http-network-error';
import type { HttpFetch } from '@pkgs/http-client-shared/types';
import type { SecureStorageStore } from '@pkgs/secure-storage-shared/secure-storage-store';
import { writeSecureStorageItem } from '@pkgs/secure-storage-shared/secure-storage-store';
import type { CreateId } from '@pkgs/uuid-shared/create-id';
import { collectDeviceSnapshot } from './collect-device-snapshot';

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
  /**
   * The token of a sign-in whose account is not ready yet. It is not the
   * session until `/identity/refresh` binds its account: the device stays
   * the guest it was, and shows it, until then.
   */
  signingInTokenRef: { current: string | null };
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
    if (this.wantedToken() !== token) return;
    this.deps.signingInTokenRef.current = null;
    const session = this.session();
    // Both flip in memory in this tick, the account first: nothing ever shows
    // the sign-in over the guest's data, or the guest's data as signed in.
    await Promise.all([
      writeSecureStorageItem(
        this.deps.store,
        LAST_LOCAL_ACCOUNT_ID_KEY,
        accountId
      ),
      session.write({ token, expiresAt, externalUserId }),
    ]);
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
    if (this.session().readToken() !== token) {
      this.deps.signingInTokenRef.current = token;
    }
    if (this.deps.inFlightRef.current) {
      this.deps.pendingTokenRef.current = token;
      return;
    }
    this.deps.inFlightRef.current = true;
    this.deps.pendingTokenRef.current = null;
    try {
      const accountId = await this.refreshAccountId(token);
      if (accountId === null) return;
      if (this.wantedToken() !== token) {
        this.discardStaleRefresh(this.wantedToken());
        return;
      }
      await this.applyRefreshSuccess({
        token,
        accountId,
        expiresAt,
        externalUserId,
      });
    } catch (e) {
      // Dead bearer → clear + anon rebind is expected recovery (cold storage /
      // expired JWT). Keep non-auth failures as errors.
      if (isUnauthorizedRefreshError(e)) {
        this.deps.log.warn('auth/refresh unauthorized; rotating to anon', {
          error: e instanceof Error ? e.message : String(e),
        });
        await this.handleSignedOut({ rotateAccount: true });
        return;
      }
      this.deps.log.error('auth/refresh failed', {
        error: e instanceof Error ? e.message : String(e),
      });
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
    this.deps.signingInTokenRef.current = null;
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
      if (!shouldBindAnonUserAfterEnsure(this.wantedToken())) {
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

  /**
   * The token the device wants as its session: a sign-in still finishing,
   * else the saved one. A refresh for any other token is stale.
   */
  private wantedToken(): string | null {
    return this.deps.signingInTokenRef.current ?? this.session().readToken();
  }

  /**
   * `/identity/refresh` for `token`. A sign-in still finishing waits out a
   * lost connection and tries again, so it is never silently dropped;
   * `null` when a sign-out or a newer sign-in replaced it meanwhile.
   */
  private async refreshAccountId(token: string): Promise<string | null> {
    while (true) {
      try {
        const { accountId } = await refreshAuth({
          apiUrl: this.deps.apiUrl,
          bearerToken: token,
          deviceId: this.deps.deviceId,
          fetchFn: this.deps.fetchFn,
          deviceSnapshot: collectDeviceSnapshot(),
        });
        return accountId;
      } catch (e) {
        const waitUntilAvailable = this.deps.waitUntilAvailable;
        const retry =
          e instanceof HttpNetworkError &&
          waitUntilAvailable !== undefined &&
          this.deps.signingInTokenRef.current === token;
        if (!retry) throw e;
        await waitUntilAvailable();
        if (this.wantedToken() !== token) return null;
      }
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
