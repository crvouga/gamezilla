import { useMyId } from '@libs/auth-client/use-current-user';
import type { CustomGameChoice } from '@libs/chess-custom-game-shared/custom-game-choice';
import { customGameCreatorRefusal } from '@libs/chess-custom-game-shared/custom-game-refusal';
import { CustomGamesAttr } from '@libs/chess-custom-game-shared/custom-game-state';
import { PERMISSION } from '@libs/permissions-shared/permission-catalog';
import { useSpaceOpenRooms } from '@libs/spaces-client/space-open-rooms-store';
import { useSpaceRoomSessionId } from '@libs/spaces-client/space-room-context';
import { useSpaceCan } from '@libs/spaces-client/use-space-can';
import { useSpaceHostConnection } from '@libs/spaces-client/use-space-host-connection';
import { useClock, useTimers } from '@pkgs/clock-client/solid';
import { useSyncEngine } from '@pkgs/sync-engine-client/sync-engine-context';
import { createSignal, onCleanup } from 'solid-js';
import { confirmCustomGameChoice } from './confirm-custom-game-choice';

export function useCustomGameCommand() {
  const rooms = useSpaceOpenRooms();
  const spaceId = useSpaceRoomSessionId();
  const timers = useTimers();
  const clock = useClock();
  const canHost = useSpaceCan(
    () => spaceId() ?? '',
    PERMISSION.chessCustomCreate
  );
  const hostConnection = useSpaceHostConnection();
  const myId = useMyId();
  const engine = useSyncEngine();
  const [error, setError] = createSignal('');
  const [settled, setSettled] = createSignal(0);
  const pending = new Set<() => void>();
  onCleanup(() => {
    for (const cancel of pending) cancel();
  });
  const send = async (choice: CustomGameChoice): Promise<void> => {
    setError('');
    // A guest's own lost connection is a different refusal from the host being
    // gone, and the creator's authority is named before the host being gone.
    if (engine.status().online && hostConnection() === 'host-offline') {
      const snapshot = rooms.getEntry(spaceId() ?? '')?.room.getSnapshot();
      const reason =
        customGameCreatorRefusal(
          snapshot === undefined
            ? null
            : CustomGamesAttr.from(snapshot).current,
          choice,
          myId()
        ) || 'the host is offline';
      setError(reason);
      setSettled((value) => value + 1);
      throw new Error(reason);
    }
    try {
      await confirmCustomGameChoice(
        {
          room: rooms.getEntry(spaceId() ?? '')?.room,
          timers,
          clock,
          canHost: canHost(),
          pending,
        },
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
