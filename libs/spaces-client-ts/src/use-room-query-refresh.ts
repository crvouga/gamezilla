import { useLogger } from '@pkgs/logger-client-ts/solid';
import type { ClientTransport } from '@pkgs/room-root-shared-ts/transport';
import { useSyncEngineInstance } from '@pkgs/sync-engine-client-ts/sync-engine-context';
import { type Accessor, createEffect, onCleanup } from 'solid-js';

/** Room closure can invalidate a public preview without a membership wake topic. */
export function useRoomQueryRefresh(
  transport: Accessor<ClientTransport | null>
): void {
  const engine = useSyncEngineInstance();
  const logger = useLogger('space-room');
  createEffect(() => {
    const current = transport();
    if (current === null) return;
    onCleanup(
      current.onHandlers({
        onClose: () => {
          void engine
            .refreshQueries()
            .catch((error) =>
              logger.error('Could not refresh a closed space', { error })
            );
        },
      })
    );
  });
}
