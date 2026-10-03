import { useMyId } from '@libs/auth/public/use-current-user';
import { PERMISSION } from '@libs/permissions/public/permission-catalog';
import { spaceSeatMemberIds } from '@libs/spaces/public/room/space-members';
import { useSpaceRoomSessionId } from '@libs/spaces/public/room/space-room-context';
import {
  useSpaceRoomDispatch,
  useSpaceRoomSelector,
} from '@libs/spaces/public/room/use-space-room-selector';
import { useSpaceCan } from '@libs/spaces/public/use-space-can';
import { useSpaceDecision } from '@libs/spaces/public/use-space-decision';
import { RoomMetaAttr } from '@pkgs/room';
import { createMemo } from 'solid-js';
import {
  CHESS_SCREEN,
  SetChessMainMenuScreen,
} from '../../shared/chess/chess-main-menu';
import type { CustomGameInput } from '../../shared/custom-game/custom-game-choice';
import {
  CustomGamesAttr,
  customGamePersonSide,
} from '../../shared/custom-game/custom-game-state';
import { useCustomGameCommand } from '../../use-cases/change-custom-game/client/use-custom-game-command';

export type CustomGameScreenModel = ReturnType<typeof useCustomGameScreen>;

export function useCustomGameScreen() {
  const myId = useMyId();
  const spaceId = useSpaceRoomSessionId();
  const scope = (): string => spaceId() ?? '';
  const games = useSpaceRoomSelector(CustomGamesAttr.from);
  const current = createMemo(() => games().current);
  const members = useSpaceRoomSelector(spaceSeatMemberIds);
  const connected = useSpaceRoomSelector(
    (s) => RoomMetaAttr.isConnected.from(s) && RoomMetaAttr.isSynced.from(s)
  );
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
