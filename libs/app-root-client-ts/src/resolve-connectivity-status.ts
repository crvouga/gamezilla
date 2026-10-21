import type { SyncConnectionState } from '@pkgs/sync-engine-client-ts/sync-status';
import type { StatusDotStatus } from '@pkgs/ui-root-client-ts/status-dot';

/**
 * A live, synced engine connection is proof of reachability and outranks the
 * browser's `navigator.onLine`, which embedded / proxied browsers misreport.
 * Otherwise a device-offline flag wins.
 */
export function resolveConnectivityStatus(args: {
  readonly browserOnline: boolean;
  readonly syncOnline: boolean;
  readonly syncError: boolean;
  readonly connection: SyncConnectionState;
  readonly hasSynced: boolean;
}): StatusDotStatus {
  const live =
    args.connection === 'connected' &&
    args.hasSynced &&
    args.syncOnline &&
    !args.syncError;
  if (live) return 'online';
  if (!args.browserOnline) return 'offline';
  if (args.syncError) return 'warning';
  if (args.connection === 'disconnected' || !args.syncOnline) return 'offline';
  return 'pending';
}
