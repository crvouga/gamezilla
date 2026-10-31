import type { AppLifecycle } from '@pkgs/sync-engine-shared-ts/app-lifecycle';
import type { LocalSyncStatusStore } from './local-sync-status';

/** Report injected connectivity changes immediately, even while query scopes cannot answer. */
export function bindSyncConnectivity(
  lifecycle: AppLifecycle | undefined,
  status: LocalSyncStatusStore,
  observe?: (online: boolean) => void
): () => void {
  status.patch({ online: lifecycle?.isOnline() ?? true });
  return (
    lifecycle?.subscribe((event) => {
      if (event === 'online' || event === 'offline') {
        observe?.(event === 'online');
        status.patch({ online: event === 'online' });
      }
    }) ?? (() => undefined)
  );
}
