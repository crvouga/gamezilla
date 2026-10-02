import { useSpaceRoomSessionId } from '@libs/spaces/public/room/space-room-context';
import { useSpaceOpenRooms } from '@libs/spaces/public/room/space-open-rooms-context';
import { useTimers } from '@pkgs/clock/solid';
import { createSignal, onCleanup } from 'solid-js';
import type { CustomGameChoice } from '../../../shared/custom-game/custom-game-choice';
import { confirmCustomGameChoice } from './confirm-custom-game-choice';

export function useCustomGameCommand() {
  const rooms = useSpaceOpenRooms();
  const spaceId = useSpaceRoomSessionId();
  const timers = useTimers();
  const [error, setError] = createSignal('');
  const [settled, setSettled] = createSignal(0);
  const pending = new Set<() => void>();
  onCleanup(() => {
    for (const cancel of pending) cancel();
  });
  const send = async (choice: CustomGameChoice): Promise<void> => {
    setError('');
    try {
      await confirmCustomGameChoice(
        { room: rooms.getEntry(spaceId() ?? '')?.room, timers, pending },
        choice
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'choice failed');
      throw cause;
    } finally {
      setSettled((value) => value + 1);
    }
  };
  return { send, error, settled };
}
