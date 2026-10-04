import type { ClientTransport } from '@pkgs/room-root-shared/transport';
import { type Accessor, createEffect, onCleanup } from 'solid-js';

/**
 * When the tab returns to the foreground, probe the room WebSocket so a
 * zombie socket (still OPEN locally but orphaned after DO hibernation / OS
 * networking pause) is detected and reconnected without a full reload.
 */
export function useRoomResumeLiveness(
  transport: Accessor<ClientTransport | null>
): void {
  createEffect(() => {
    const current = transport();
    if (current === null) return;
    const probe = current.probeLiveness?.bind(current);
    if (probe === undefined) return;
    const onVisible = (): void => {
      if (document.visibilityState === 'visible') probe();
    };
    const onFocus = (): void => {
      probe();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onFocus);
    onCleanup(() => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onFocus);
    });
  });
}
