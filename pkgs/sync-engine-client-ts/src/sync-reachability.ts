import { HttpNetworkError } from '@pkgs/http-client-shared-ts/http-network-error';
import type { LocalSyncStatusStore } from './local-sync-status';
import { SyncApiAuthError } from './sync-http-client';

function isHttpNetworkError(error: unknown): boolean {
  return (
    error instanceof HttpNetworkError ||
    (error instanceof Error && error.name === 'HttpNetworkError')
  );
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Whether the server can be reached, as sync requests show it. Being offline
 * means the device cannot reach everyone else, so online-only actions are
 * refused. A failed request is not by itself that: a server that answered
 * with an error is reachable, and a request that never reached it on a
 * confirmed connection is a hiccup the app retries on its own. The device is
 * offline when a request cannot reach the server before the connection is
 * confirmed, or again after that retry.
 */
export type SyncReachability = {
  /** A sweep answered every scope: the connection is confirmed. */
  readonly synced: () => void;
  /** The server accepted an upload: it is reachable. */
  readonly answered: () => void;
  /** A sync request failed (not an expired or revoked session). */
  readonly failed: (error: unknown) => void;
};

export function createSyncReachability(args: {
  readonly status: LocalSyncStatusStore;
  readonly isOnline: () => boolean;
  readonly now: () => number;
}): SyncReachability {
  let unanswered = 0;
  const unreachable = (error: unknown): boolean => {
    if (!isHttpNetworkError(error)) return false;
    unanswered += 1;
    return !args.status.status.getSnapshot().hasSynced || unanswered > 1;
  };
  return {
    synced: () => {
      unanswered = 0;
      args.status.patch({
        connection: 'connected',
        online: args.isOnline(),
        hasSynced: true,
        lastSyncedAtMs: args.now(),
        lastError: null,
        upgradeRequired: false,
      });
    },
    answered: () => {
      unanswered = 0;
    },
    failed: (error) => {
      // Protocol cut: the app is outdated. Kept until a sync succeeds again.
      const upgradeRequired =
        error instanceof SyncApiAuthError &&
        error.reason === 'upgrade_required';
      args.status.patch({
        lastError: errorMessage(error),
        ...(upgradeRequired || unreachable(error) ? { online: false } : {}),
        ...(upgradeRequired ? { upgradeRequired: true } : {}),
      });
    },
  };
}
