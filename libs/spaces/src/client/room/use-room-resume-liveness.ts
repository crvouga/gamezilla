import type { ClientTransport } from '@pkgs/room';
import { useEffect } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

/**
 * When the app returns to the foreground, probe the room WebSocket so a
 * zombie socket (still OPEN locally but orphaned after DO hibernation / OS
 * networking pause) is detected and reconnected without a full reload.
 */
export function useRoomResumeLiveness(transport: ClientTransport | null): void {
  useEffect(() => {
    if (transport === null) return;
    const probe = transport.probeLiveness?.bind(transport);
    if (probe === undefined) return;
    const onChange = (state: AppStateStatus): void => {
      if (state === 'active') probe();
    };
    const sub = AppState.addEventListener('change', onChange);
    return () => sub.remove();
  }, [transport]);
}
