import { useMyId } from '@libs/auth-client/use-current-user';
import { customGameAwaySince } from '@libs/game-session-shared/custom-game-absence';
import { CustomGameAvailableAttr } from '@libs/game-session-shared/custom-game-availability';
import type { CustomGameInput } from '@libs/game-session-shared/custom-game-choice';
import { soloCustomGame } from '@libs/game-session-shared/custom-game-local';
import {
  type CustomGames,
  CustomGamesAttr,
  customGamePersonSide,
} from '@libs/game-session-shared/custom-game-state';
import { PERMISSION } from '@libs/permissions-shared/permission-catalog';
import { useSyncedProfiles } from '@libs/profile-client/use-synced-profiles';
import { useSpaceRoomSessionId } from '@libs/spaces-client/space-room-context';
import { useSpaceCan } from '@libs/spaces-client/use-space-can';
import { useSpaceDecision } from '@libs/spaces-client/use-space-decision';
import { useSpaceRoomSelector } from '@libs/spaces-client/use-space-room-selector';
import {
  SpaceMembersRoomAttr,
  spaceSeatMemberIds,
} from '@libs/spaces-shared/space-members-messages';
import { RoomMetaAttr } from '@pkgs/room-root-client/room-meta';
import { useTurnGames } from '@pkgs/turn-game-client/turn-games-context';
import { type Accessor, createMemo } from 'solid-js';
import { useCustomGameCommand } from './use-custom-game-command';
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

export type CustomGameScreenModel = ReturnType<typeof useCustomGameScreen>;

export function useCustomGameScreen(
  back: () => void,
  gameId: Accessor<string>,
  openHistory?: () => void
) {
  const myId = useMyId();
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
  // Name everyone the screen shows: the members, and whoever holds a side.
  useSyncedProfiles(() => {
    const game = current();
    return game === null
      ? members()
      : [...members(), game.creator, game.white.person, game.black.person];
  });
  const canCreate = useSpaceCan(scope, PERMISSION.gameCustomCreate);
  const canSubmit = createMemo(
    () =>
      connected() ||
      (canCreate() &&
        current()?.creator === myId() &&
        soloCustomGame(current()))
  );
  const command = useCustomGameCommand();
  const choose = (input: CustomGameInput): Promise<void> =>
    command.send({
      ...input,
      ...(input.operation === 'create' ? { game: gameId() } : {}),
      gameId: visible().current?.id ?? null,
      revision: visible().current?.revision ?? 0,
    });
  const playBot = async (): Promise<void> => {
    await choose({ operation: 'create' });
    await choose({ operation: 'bot', side: 'black' });
    await choose({ operation: 'ready' });
    await choose({ operation: 'start' });
  };
  return {
    myId,
    games,
    current,
    members,
    connected,
    canSubmit,
    sharedAvailable,
    choose,
    playBot,
    attempt: command.send,
    error: command.error,
    settled: command.settled,
    submitting: command.submitting,
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
