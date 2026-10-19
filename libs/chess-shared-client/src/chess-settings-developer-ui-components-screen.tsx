import {
  CHESS_SCREEN,
  SetChessSelectedUiComponent,
} from '@libs/chess-root-shared/chess-screens';
import { DefineBackButton } from '@libs/spaces-client/spaces-nav-context';
import { useGameScreen } from '@libs/spaces-client/use-game-screen';
import { useSpaceRoomDispatch } from '@libs/spaces-client/use-space-room-selector';
import { ExplorerList } from '@pkgs/ui-root-client/explorer-list';
import type { JSX } from 'solid-js';
import { CHESS_COMPONENT_ENTRIES } from './chess-board-register-example';

export function ChessSettingsDeveloperUiComponentsScreen(): JSX.Element {
  const dispatch = useSpaceRoomDispatch();
  const gameScreen = useGameScreen();

  const back = (): void => {
    gameScreen.show(CHESS_SCREEN.settingsDeveloper);
  };

  const onSelect = (id: string): void => {
    dispatch(SetChessSelectedUiComponent({ name: id }));
    gameScreen.show(CHESS_SCREEN.settingsDeveloperUiDetail);
  };

  return (
    <div class="box self-stretch flex-1">
      <DefineBackButton onPress={back} />
      <ExplorerList onSelect={onSelect} entries={CHESS_COMPONENT_ENTRIES} />
    </div>
  );
}
