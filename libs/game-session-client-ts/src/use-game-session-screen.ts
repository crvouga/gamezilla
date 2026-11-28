import { useMyId } from '@libs/auth-client-ts/use-current-user';
import { gameSessionAwaySince } from '@libs/game-session-shared-ts/game-session-absence';
import { GameSessionAvailableAttr } from '@libs/game-session-shared-ts/game-session-availability';
import { soloGameSession } from '@libs/game-session-shared-ts/game-session-local';
import {
  type GameSession,
  type GameSessions,
  GameSessionsAttr,
  gameSessionPersonSide,
  gameSessionTerminal,
  gameSessionUnderWay,
} from '@libs/game-session-shared-ts/game-session-state';
import { gameSessionChoiceWaits } from '@libs/game-session-shared-ts/game-session-waiting-move';
import { PERMISSION } from '@libs/permissions-shared-ts/permission-catalog';
import { useSyncedProfiles } from '@libs/profile-client-ts/use-synced-profiles';
import { useSpaceRoomSessionId } from '@libs/spaces-client-ts/space-room-context';
import { useSpaceCan } from '@libs/spaces-client-ts/use-space-can';
import { useSpaceDecision } from '@libs/spaces-client-ts/use-space-decision';
import { useSpaceRoomSelector } from '@libs/spaces-client-ts/use-space-room-selector';
import {
  SpaceMembersRoomAttr,
  spaceSeatMemberIds,
} from '@libs/spaces-shared-ts/space-members-messages';
import { RoomMetaAttr } from '@pkgs/room-root-client-ts/room-meta';
import { useTurnGames } from '@pkgs/turn-game-client-ts/turn-games-context';
import { gameSides } from '@pkgs/turn-game-shared-ts/game-rules';
import { type Accessor, createMemo } from 'solid-js';
import { useGameSessionChoices } from './use-game-session-choices';
import { useGameSessionCommand } from './use-game-session-command';
import { useGameSessionCommitment } from './use-game-session-commitment';
import { useGameSessionHand } from './use-game-session-hand';
import { useGameSessionPrivateSetup } from './use-game-session-private-setup';
import { useRoomSimulation } from './use-room-simulation';
import { useVisibleGameSessions } from './use-visible-game-sessions';

function useSelectedGameSessions(
  visible: Accessor<GameSessions>,
  gameId: Accessor<string>
) {
  const rules = useTurnGames();
  return createMemo(() => {
    const { current, history } = visible();
    const definition =
      current !== null && !gameSessionTerminal(current)
        ? rules.forPosition(current.fen)
        : rules.byId(gameId());
    return {
      current:
        current !== null && definition.recognizes(current.fen) ? current : null,
      history: history.filter((game) => definition.recognizes(game.fen)),
    };
  });
}
function useAwayParticipants() {
  return useSpaceRoomSelector((state) =>
    Object.fromEntries(
      Object.keys(SpaceMembersRoomAttr.away.from(state)).map((person) => [
        person,
        gameSessionAwaySince(state, person),
      ])
    )
  );
}

/** Whether a move made now, with no connection, would wait for it. */
function useMovesWait(
  connected: Accessor<boolean>,
  current: Accessor<GameSession | null>,
  myId: Accessor<string>
): Accessor<boolean> {
  const rules = useTurnGames();
  return createMemo(
    () =>
      !connected() &&
      gameSessionChoiceWaits(current(), { operation: 'move' }, rules, myId())
  );
}

/** Name the members and everyone occupying one of the declared seats. */
function useGameSessionProfiles(
  current: Accessor<GameSession | null>,
  members: Accessor<readonly string[]>
): void {
  useSyncedProfiles(() => {
    const game = current();
    return game === null
      ? members()
      : [
          ...members(),
          game.creator,
          ...game.sides.map((side) => game[side].person),
        ];
  });
}

export type GameSessionScreenModel = ReturnType<typeof useGameSessionScreen>;

function useGameSessionPermissions(scope: Accessor<string>) {
  return {
    canCreate: useSpaceCan(scope, PERMISSION.gameSessionCreate),
    canConfigure: useSpaceCan(scope, PERMISSION.gameSessionConfigure),
    canInvite: useSpaceCan(scope, PERMISSION.gameSessionInvite),
    canBot: useSpaceCan(scope, PERMISSION.gameSessionBot),
    canStart: useSpaceCan(scope, PERMISSION.gameSessionStart),
    canCancel: useSpaceCan(scope, PERMISSION.gameSessionCancel),
    canJoin: useSpaceCan(scope, PERMISSION.gameSessionJoin),
    canPlay: useSpaceCan(scope, PERMISSION.gameSessionPlay),
  };
}

export function useGameSessionScreen(
  back: () => void,
  gameId: Accessor<string>,
  openHistory?: () => void
) {
  const myId = useMyId();
  const rules = useTurnGames();
  const spaceId = useSpaceRoomSessionId();
  const scope = (): string => spaceId() ?? '';
  const roomGames = useSpaceRoomSelector(GameSessionsAttr.from);
  const visible = useVisibleGameSessions(roomGames);
  const games = useSelectedGameSessions(visible, gameId);
  const current = createMemo(() => games().current);
  const members = useSpaceRoomSelector(spaceSeatMemberIds);
  const away = useAwayParticipants();
  const sharedAvailable = useSpaceRoomSelector(GameSessionAvailableAttr.from);
  const connected = useSpaceRoomSelector(
    (s) => RoomMetaAttr.isConnected.from(s) && RoomMetaAttr.isSynced.from(s)
  );
  useGameSessionProfiles(current, members);
  const permissions = useGameSessionPermissions(scope);
  const canSubmit = createMemo(
    () =>
      connected() ||
      (permissions.canCreate() &&
        current()?.creator === myId() &&
        soloGameSession(current(), rules))
  );
  const simulation = useRoomSimulation(current, myId, permissions.canPlay);
  const command = useGameSessionCommand(simulation.chooseLocal);
  const privateSetup = useGameSessionPrivateSetup(current, myId);
  const choices = useGameSessionChoices({
    gameId,
    current: () => visible().current,
    send: command.send,
    privateSetup,
  });
  return {
    myId,
    sides: () => current()?.sides ?? gameSides(rules.byId(gameId())),
    games,
    current,
    members,
    connected,
    canSubmit,
    simulation,
    sharedAvailable,
    ...choices,
    privateSetup,
    /** The person's own dealt hand in the current game; never another's. */
    ownHand: useGameSessionHand(current, myId),
    /** The person's own commitment in the phase open now; never another's. */
    ownCommitment: useGameSessionCommitment(current, myId),
    attempt: command.send,
    error: command.error,
    settled: command.settled,
    submitting: command.submitting,
    /** Whether a move made with no connection waits for it to return. */
    waiting: command.waiting,
    /** Whether a move made now, with no connection, would wait for it. */
    movesWait: useMovesWait(connected, current, myId),
    mySide: createMemo(() => {
      const game = current();
      return game === null ? null : gameSessionPersonSide(game, myId());
    }),
    /** The people in the space who are away, each with since when. */
    away,
    /** Since when a person in the space has been away, or `null` while present. */
    awaySince: (person: string): number | null => away()[person] ?? null,
    watchDecision: useSpaceDecision(scope, PERMISSION.gameSessionWatch),
    ...permissions,
    /** A game session is under way: the space stays on its board. */
    underWay: createMemo(() => gameSessionUnderWay(roomGames())),
    back,
    openHistory,
  };
}
