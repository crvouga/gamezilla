import { useMyId } from '@libs/auth-client-ts/use-current-user';
import { customGameAwaySince } from '@libs/game-session-shared-ts/custom-game-absence';
import { CustomGameAvailableAttr } from '@libs/game-session-shared-ts/custom-game-availability';
import type { CustomGameInput } from '@libs/game-session-shared-ts/custom-game-choice';
import { soloCustomGame } from '@libs/game-session-shared-ts/custom-game-local';
import {
  type CustomGame,
  type CustomGames,
  CustomGamesAttr,
  customGamePersonSide,
} from '@libs/game-session-shared-ts/custom-game-state';
import { customGameChoiceWaits } from '@libs/game-session-shared-ts/custom-game-waiting-move';
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
import { type GameSide, gameSides } from '@pkgs/turn-game-shared-ts/game-rules';
import { type Accessor, createMemo } from 'solid-js';
import { useCustomGameCommand } from './use-custom-game-command';
import { useCustomGamePrivateSetup } from './use-custom-game-private-setup';
import { useVisibleCustomGames } from './use-visible-custom-games';

function useSelectedCustomGames(
  visible: Accessor<CustomGames>,
  gameId: Accessor<string>
) {
  const rules = useTurnGames();
  return createMemo(() => {
    const id = gameId();
    const definition = rules.byId(id);
    const current = visible().current;
    return {
      current:
        current !== null && definition.recognizes(current.fen)
          ? visible().current
          : null,
      history: visible().history.filter((game) =>
        definition.recognizes(game.fen)
      ),
    };
  });
}
function useAwayParticipants() {
  return useSpaceRoomSelector((state) =>
    Object.fromEntries(
      Object.keys(SpaceMembersRoomAttr.away.from(state)).map((person) => [
        person,
        customGameAwaySince(state, person),
      ])
    )
  );
}

/** Becoming ready, with the person's private setup for a game that has one. */
function readyChoices(
  choose: (input: CustomGameInput) => Promise<void>,
  privateSetup: ReturnType<typeof useCustomGamePrivateSetup>,
  sides: Accessor<readonly GameSide[]>
) {
  const ready = (): Promise<void> =>
    choose(
      privateSetup.has()
        ? { operation: 'ready', setup: privateSetup.draft() }
        : { operation: 'ready' }
    );
  const playBot = async (): Promise<void> => {
    await choose({ operation: 'create' });
    for (const side of sides().slice(1))
      await choose({ operation: 'bot', side });
    if (privateSetup.has() && !privateSetup.complete()) privateSetup.random();
    await ready();
    await choose({ operation: 'start' });
  };
  return { ready, playBot };
}

/** Whether a move made now, with no connection, would wait for it. */
function useMovesWait(
  connected: Accessor<boolean>,
  current: Accessor<CustomGame | null>
): Accessor<boolean> {
  const rules = useTurnGames();
  return createMemo(
    () =>
      !connected() &&
      customGameChoiceWaits(current(), { operation: 'move' }, rules)
  );
}

/** Name the members and everyone occupying one of the declared seats. */
function useCustomGameProfiles(
  current: Accessor<CustomGame | null>,
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

export type CustomGameScreenModel = ReturnType<typeof useCustomGameScreen>;

export function useCustomGameScreen(
  back: () => void,
  gameId: Accessor<string>,
  openHistory?: () => void
) {
  const myId = useMyId();
  const rules = useTurnGames();
  const spaceId = useSpaceRoomSessionId();
  const scope = (): string => spaceId() ?? '';
  const roomGames = useSpaceRoomSelector(CustomGamesAttr.from);
  const visible = useVisibleCustomGames(roomGames);
  const games = useSelectedCustomGames(visible, gameId);
  const current = createMemo(() => games().current);
  const members = useSpaceRoomSelector(spaceSeatMemberIds);
  const away = useAwayParticipants();
  const sharedAvailable = useSpaceRoomSelector(CustomGameAvailableAttr.from);
  const connected = useSpaceRoomSelector(
    (s) => RoomMetaAttr.isConnected.from(s) && RoomMetaAttr.isSynced.from(s)
  );
  useCustomGameProfiles(current, members);
  const canCreate = useSpaceCan(scope, PERMISSION.gameCustomCreate);
  const canSubmit = createMemo(
    () =>
      connected() ||
      (canCreate() &&
        current()?.creator === myId() &&
        soloCustomGame(current(), rules))
  );
  const command = useCustomGameCommand();
  const choose = (input: CustomGameInput): Promise<void> =>
    command.send({
      ...input,
      ...(input.operation === 'create' ? { game: gameId() } : {}),
      gameId: visible().current?.id ?? null,
      revision: visible().current?.revision ?? 0,
    });
  const privateSetup = useCustomGamePrivateSetup(current, myId);
  const { ready, playBot } = readyChoices(choose, privateSetup, () =>
    gameSides(rules.byId(gameId()))
  );
  return {
    myId,
    playerCount: () => gameSides(rules.byId(gameId())).length,
    games,
    current,
    members,
    connected,
    canSubmit,
    sharedAvailable,
    choose,
    ready,
    privateSetup,
    playBot,
    attempt: command.send,
    error: command.error,
    settled: command.settled,
    submitting: command.submitting,
    /** Whether a move made with no connection waits for it to return. */
    waiting: command.waiting,
    /** Whether a move made now, with no connection, would wait for it. */
    movesWait: useMovesWait(connected, current),
    mySide: createMemo(() => {
      const game = current();
      return game === null ? null : customGamePersonSide(game, myId());
    }),
    /** The people in the space who are away, each with since when. */
    away,
    /** Since when a person in the space has been away, or `null` while present. */
    awaySince: (person: string): number | null => away()[person] ?? null,
    watchDecision: useSpaceDecision(scope, PERMISSION.gameCustomWatch),
    canCreate,
    canConfigure: useSpaceCan(scope, PERMISSION.gameCustomConfigure),
    canInvite: useSpaceCan(scope, PERMISSION.gameCustomInvite),
    canBot: useSpaceCan(scope, PERMISSION.gameCustomBot),
    canStart: useSpaceCan(scope, PERMISSION.gameCustomStart),
    canCancel: useSpaceCan(scope, PERMISSION.gameCustomCancel),
    canJoin: useSpaceCan(scope, PERMISSION.gameCustomJoin),
    canPlay: useSpaceCan(scope, PERMISSION.gameCustomPlay),
    back,
    openHistory,
  };
}
