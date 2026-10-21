import { useMyId } from '@libs/auth-client-ts/use-current-user';
import type { CustomGameChoice } from '@libs/game-session-shared-ts/custom-game-choice';
import { customGameCreatorRefusal } from '@libs/game-session-shared-ts/custom-game-refusal';
import { CustomGamesAttr } from '@libs/game-session-shared-ts/custom-game-state';
import { PERMISSION } from '@libs/permissions-shared-ts/permission-catalog';
import { useSpaceOpenRooms } from '@libs/spaces-client-ts/space-open-rooms-store';
import { useSpaceRoomSessionId } from '@libs/spaces-client-ts/space-room-context';
import { useSpaceCan } from '@libs/spaces-client-ts/use-space-can';
import {
  SpaceField,
  useSpaceColumn,
} from '@libs/spaces-client-ts/use-space-column';
import { useSpaceHostConnection } from '@libs/spaces-client-ts/use-space-host-connection';
import { SPACE_ROOM_NAME } from '@libs/spaces-client-ts/use-space-room-selector';
import { useClock, useTimers } from '@pkgs/clock-client-ts/solid';
import { useNamedRoomRoster } from '@pkgs/room-root-client-ts/room-clients-context';
import { useSyncEngine } from '@pkgs/sync-engine-client-ts/sync-engine-context';
import { useTurnGames } from '@pkgs/turn-game-client-ts/turn-games-context';
import { createSignal, onCleanup } from 'solid-js';
import { confirmCustomGameChoice } from './confirm-custom-game-choice';

export function useCustomGameCommand() {
  const rooms = useSpaceOpenRooms();
  const spaceId = useSpaceRoomSessionId();
  const timers = useTimers();
  const clock = useClock();
  const rules = useTurnGames();
  const canHost = useSpaceCan(
    () => spaceId() ?? '',
    PERMISSION.gameCustomCreate
  );
  const hostConnection = useSpaceHostConnection();
  const hostId = useSpaceColumn(() => spaceId() ?? '', SpaceField.hostMemberId);
  const roster = useNamedRoomRoster(SPACE_ROOM_NAME);
  const myId = useMyId();
  const engine = useSyncEngine();
  const [error, setError] = createSignal('');
  const [settled, setSettled] = createSignal(0);
  const [submitting, setSubmitting] = createSignal(false);
  const [waiting, setWaiting] = createSignal(false);
  const pending = new Set<() => void>();
  onCleanup(() => {
    for (const cancel of pending) cancel();
  });
  const send = async (choice: CustomGameChoice): Promise<void> => {
    setError('');
    // A guest's own lost connection is a different refusal from the host being
    // gone, and the creator's authority is named before the host being gone.
    const hostAbsent =
      hostId() !== null &&
      hostId() !== myId() &&
      !roster().some((actor) => actor.id === hostId());
    if (
      engine.status().online &&
      (hostAbsent || hostConnection() === 'host-offline')
    ) {
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
      setSubmitting(true);
      await confirmCustomGameChoice(
        {
          room: rooms.getEntry(spaceId() ?? '')?.room,
          timers,
          clock,
          canHost: canHost(),
          pending,
          rules,
          onWaiting: () => setWaiting(true),
        },
        choice
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'choice failed');
      throw cause;
    } finally {
      setWaiting(false);
      setSubmitting(false);
      setSettled((value) => value + 1);
    }
  };
  /** Whether a move made with no connection waits for it to return. */
  return { send, error, settled, submitting, waiting };
}
