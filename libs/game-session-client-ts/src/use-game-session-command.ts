import { useMyId } from '@libs/auth-client-ts/use-current-user';
import type { GameSessionChoice } from '@libs/game-session-shared-ts/game-session-choice';
import { gameSessionCreatorRefusal } from '@libs/game-session-shared-ts/game-session-refusal';
import { GameSessionsAttr } from '@libs/game-session-shared-ts/game-session-state';
import { PERMISSION } from '@libs/permissions-shared-ts/permission-catalog';
import { useOptionalSpaceModule } from '@libs/spaces-client-ts/space-module-context';
import { useSpaceOpenRooms } from '@libs/spaces-client-ts/space-open-rooms-store';
import { useSpaceRoomSessionId } from '@libs/spaces-client-ts/space-room-context';
import { useSpaceCan } from '@libs/spaces-client-ts/use-space-can';
import {
  SpaceField,
  useSpaceColumn,
} from '@libs/spaces-client-ts/use-space-column';
import { useSpaceHostConnection } from '@libs/spaces-client-ts/use-space-host-connection';
import {
  SPACE_ROOM_NAME,
  useSpaceRoomSelector,
} from '@libs/spaces-client-ts/use-space-room-selector';
import { useClock, useTimers } from '@pkgs/clock-client-ts/solid';
import { useNamedRoomRoster } from '@pkgs/room-root-client-ts/room-clients-context';
import { RoomMetaAttr } from '@pkgs/room-root-client-ts/room-meta';
import type {
  RoomCommandPayload,
  RoomState,
} from '@pkgs/room-root-shared-ts/types';
import { useSyncEngine } from '@pkgs/sync-engine-client-ts/sync-engine-context';
import { useTurnGames } from '@pkgs/turn-game-client-ts/turn-games-context';
import { createSignal, onCleanup } from 'solid-js';
import { confirmGameSessionChoice } from './confirm-game-session-choice';
import { gameSessionHostKnownAbsent } from './game-session-host-absence';

/**
 * Why a choice cannot reach the host now, or `''`. A guest's own lost
 * connection is a different refusal from the host being gone, and the
 * creator's authority is named before the host being gone.
 */
function useHostRefusal(): (choice: GameSessionChoice) => string {
  const rooms = useSpaceOpenRooms();
  const spaceId = useSpaceRoomSessionId();
  const hostConnection = useSpaceHostConnection();
  const hostId = useSpaceColumn(() => spaceId() ?? '', SpaceField.hostMemberId);
  const roster = useNamedRoomRoster(SPACE_ROOM_NAME);
  const connected = useSpaceRoomSelector(RoomMetaAttr.isConnected.from);
  const hasRoster = useSpaceRoomSelector(RoomMetaAttr.hasRoster.from);
  const myId = useMyId();
  const engine = useSyncEngine();
  return (choice: GameSessionChoice): string => {
    const hostAbsent = gameSessionHostKnownAbsent({
      connected: connected(),
      hasRoster: hasRoster(),
      hostId: hostId(),
      myId: myId(),
      roster: roster(),
    });
    if (
      !engine.status().online ||
      !(hostAbsent || hostConnection() === 'host-offline')
    )
      return '';
    const snapshot = rooms.getEntry(spaceId() ?? '')?.room.getSnapshot();
    return (
      gameSessionCreatorRefusal(
        snapshot === undefined ? null : GameSessionsAttr.from(snapshot).current,
        choice,
        myId()
      ) || 'the host is offline'
    );
  };
}

export function useGameSessionCommand(
  chooseLocal?: (choice: GameSessionChoice) => Promise<void> | null
) {
  const rooms = useSpaceOpenRooms();
  const spaceId = useSpaceRoomSessionId();
  const timers = useTimers();
  const clock = useClock();
  const rules = useTurnGames();
  const myId = useMyId();
  const canHost = useSpaceCan(
    () => spaceId() ?? '',
    PERMISSION.gameSessionCreate
  );
  const hostRefusal = useHostRefusal();
  const module = useOptionalSpaceModule();
  const [error, setError] = createSignal('');
  const [settled, setSettled] = createSignal(0);
  const [submitting, setSubmitting] = createSignal(false);
  const [waiting, setWaiting] = createSignal(false);
  const pending = new Set<() => void>();
  onCleanup(() => {
    for (const cancel of pending) cancel();
  });
  // A choice made here is prepared as the space's module prepares its own.
  const preparing =
    module === undefined
      ? {}
      : {
          prepare: (state: RoomState, payload: RoomCommandPayload) =>
            module.prepareLocalCommand(state, payload, clock.now()),
        };
  const send = async (choice: GameSessionChoice): Promise<string | null> => {
    setError('');
    const reason = hostRefusal(choice);
    if (reason !== '') {
      setError(reason);
      setSettled((value) => value + 1);
      throw new Error(reason);
    }
    try {
      setSubmitting(true);
      return await confirmGameSessionChoice(
        {
          room: rooms.getEntry(spaceId() ?? '')?.room,
          timers,
          clock,
          canHost: canHost(),
          pending,
          rules,
          actor: myId(),
          ...preparing,
          ...(chooseLocal === undefined ? {} : { chooseLocal }),
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
