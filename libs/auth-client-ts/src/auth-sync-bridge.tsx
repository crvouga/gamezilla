import { useLogger } from '@pkgs/logger-client-ts/solid';
import { useSyncEngineInstance } from '@pkgs/sync-engine-client-ts/sync-engine-context';
import { createEffect, type JSX, on, type ParentProps } from 'solid-js';
import { useFreshAuthToken } from './use-fresh-auth-token';

/**
 * Signing in can upgrade the guest's existing account without replacing its
 * SQLite file or remounting the engine. Refetch its scopes with the new
 * session capability so guest snapshots cannot remain indefinitely.
 */
export function AuthSyncBridge(props: ParentProps): JSX.Element {
  const token = useFreshAuthToken();
  const engine = useSyncEngineInstance();
  const log = useLogger('auth-sync');
  createEffect(
    on(
      token,
      () => {
        void engine.refreshQueries().catch((error: unknown) =>
          log.error('session query refresh failed', {
            error: error instanceof Error ? error.message : String(error),
          })
        );
      },
      { defer: true }
    )
  );
  return <>{props.children}</>;
}
