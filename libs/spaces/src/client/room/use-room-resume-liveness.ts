import type { WebSocketRoomTransport } from '@pkgs/room/client/adapters/transport/websocket';
import { useEffect } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

/**
 * When the app returns to the foreground, probe the room WebSocket so a
 * zombie socket (still OPEN locally but orphaned after DO hibernation / OS
 * networking pause) is detected and reconnected without a full reload.
 */
export function useRoomResumeLiveness(
  transport: WebSocketRoomTransport | null
): void {
  useEffect(() => {
    if (transport === null) return;
    const onChange = (state: AppStateStatus): void => {
      if (state === 'active') transport.probeLiveness();
    };
    const sub = AppState.addEventListener('change', onChange);
    return () => sub.remove();
  }, [transport]);
}
