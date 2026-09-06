import type { SyncConnectionState } from '@pkgs/sync-engine/client';
import type { StatusDotStatus } from '@pkgs/ui-rn';

export function resolveConnectivityStatus(args: {
  readonly browserOnline: boolean;
  readonly syncOnline: boolean;
  readonly syncError: boolean;
  readonly connection: SyncConnectionState;
  readonly hasSynced: boolean;
}): StatusDotStatus {
  if (!args.browserOnline) return 'offline';
  if (args.syncError) return 'warning';
  if (args.connection === 'disconnected' || !args.syncOnline) return 'offline';
  if (args.connection === 'connected' && args.hasSynced) return 'online';
  return 'pending';
}
