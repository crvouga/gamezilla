import { DefineBackButton } from '@libs/spaces/public/nav/spaces-nav-context';
import { useSpaceRoomDispatch } from '@libs/spaces/public/room/use-space-room-selector';
import { ExplorerList } from '@pkgs/ui';
import type { JSX } from 'solid-js';

import {
  CHESS_SCREEN,
  SetChessMainMenuScreen,
  SetChessSelectedUiComponent,
} from '../chess-main-menu';
import { CHESS_COMPONENT_ENTRIES } from './chess-board-register-example';

export function ChessSettingsDeveloperUiComponentsScreen(): JSX.Element {
  const dispatch = useSpaceRoomDispatch();

  const back = (): void => {
    dispatch(
      SetChessMainMenuScreen({ screen: CHESS_SCREEN.settingsDeveloper })
    );
  };

  const onSelect = (id: string): void => {
    dispatch(SetChessSelectedUiComponent({ name: id }));
    dispatch(
      SetChessMainMenuScreen({
        screen: CHESS_SCREEN.settingsDeveloperUiDetail,
      })
    );
  };

  return (
    <div class="box self-stretch flex-1">
      <DefineBackButton onPress={back} />
      <ExplorerList onSelect={onSelect} entries={CHESS_COMPONENT_ENTRIES} />
    </div>
  );
}
