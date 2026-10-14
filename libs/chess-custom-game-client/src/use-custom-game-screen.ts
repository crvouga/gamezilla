import { useMyId } from '@libs/auth-client/use-current-user';
import type { CustomGameInput } from '@libs/chess-custom-game-shared/custom-game-choice';
import {
  CustomGamesAttr,
  customGamePersonSide,
} from '@libs/chess-custom-game-shared/custom-game-state';
import {
  CHESS_SCREEN,
  SetChessMainMenuScreen,
} from '@libs/chess-root-shared/chess-main-menu';
import { PERMISSION } from '@libs/permissions-shared/permission-catalog';
import { useSyncedProfiles } from '@libs/profile-client/use-synced-profiles';
import { useSpaceRoomSessionId } from '@libs/spaces-client/space-room-context';
import { useSpaceCan } from '@libs/spaces-client/use-space-can';
import { useSpaceDecision } from '@libs/spaces-client/use-space-decision';
import {
  useSpaceRoomDispatch,
  useSpaceRoomSelector,
} from '@libs/spaces-client/use-space-room-selector';
import {
  SpaceMembersRoomAttr,
  spaceSeatMemberIds,
} from '@libs/spaces-shared/space-members-messages';
import { RoomMetaAttr } from '@pkgs/room-root-client/room-meta';
import { createMemo } from 'solid-js';
import { useCustomGameCommand } from './use-custom-game-command';
import { useVisibleCustomGames } from './use-visible-custom-games';

export type CustomGameScreenModel = ReturnType<typeof useCustomGameScreen>;

export function useCustomGameScreen() {
  const myId = useMyId();
  const spaceId = useSpaceRoomSessionId();
  const scope = (): string => spaceId() ?? '';
  const roomGames = useSpaceRoomSelector(CustomGamesAttr.from);
  const games = useVisibleCustomGames(roomGames);
  const current = createMemo(() => games().current);
  const members = useSpaceRoomSelector(spaceSeatMemberIds);
  const away = useSpaceRoomSelector(SpaceMembersRoomAttr.away.from);
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
  const command = useCustomGameCommand();
  const dispatch = useSpaceRoomDispatch();
  const choose = (input: CustomGameInput): Promise<void> =>
    command.send({
      ...input,
      gameId: current()?.id ?? null,
      revision: current()?.revision ?? 0,
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
    choose,
    playBot,
    attempt: command.send,
    error: command.error,
    settled: command.settled,
    mySide: createMemo(() => {
      const game = current();
      return game === null ? null : customGamePersonSide(game, myId());
    }),
    /** The people in the space who are away, each with since when. */
    away,
    /** Since when a person in the space has been away, or `null` while present. */
    awaySince: (person: string): number | null => away()[person] ?? null,
    watchDecision: useSpaceDecision(scope, PERMISSION.chessCustomWatch),
    canCreate: useSpaceCan(scope, PERMISSION.chessCustomCreate),
    canConfigure: useSpaceCan(scope, PERMISSION.chessCustomConfigure),
    canInvite: useSpaceCan(scope, PERMISSION.chessCustomInvite),
    canBot: useSpaceCan(scope, PERMISSION.chessCustomBot),
    canStart: useSpaceCan(scope, PERMISSION.chessCustomStart),
    canCancel: useSpaceCan(scope, PERMISSION.chessCustomCancel),
    canJoin: useSpaceCan(scope, PERMISSION.chessCustomJoin),
    canPlay: useSpaceCan(scope, PERMISSION.chessCustomPlay),
    back: () => dispatch(SetChessMainMenuScreen({ screen: CHESS_SCREEN.root })),
  };
}
