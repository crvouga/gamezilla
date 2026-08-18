import { DefineBackButton } from '@libs/spaces/public/nav/spaces-nav-context';
import { useSpaceRoomDispatch } from '@libs/spaces/public/room/use-space-room-selector';
import { Box, ExplorerList } from '@pkgs/ui';
import { type ReactNode, useCallback, useEffect } from 'react';
import {
  CHESS_SCREEN,
  SetChessMainMenuScreen,
  SetChessSelectedUiComponent,
} from '../chess-main-menu';
import {
  CHESS_COMPONENT_ENTRIES,
  ensureChessBoardExampleRegistered,
} from './chess-board-register-example';

export function ChessSettingsDeveloperUiComponentsScreen(): ReactNode {
  const dispatch = useSpaceRoomDispatch();

  /**
   * Side-effect import: registers the chess board example into the lib's
   * shared component registry. Idempotent — first opener wins.
   */
  useEffect(() => {
    ensureChessBoardExampleRegistered();
  }, []);

  const back = useCallback(() => {
    dispatch(
      SetChessMainMenuScreen({ screen: CHESS_SCREEN.settingsDeveloper })
    );
  }, [dispatch]);

  const onSelect = useCallback(
    (name: string) => {
      dispatch(SetChessSelectedUiComponent({ name }));
      dispatch(
        SetChessMainMenuScreen({
          screen: CHESS_SCREEN.settingsDeveloperUiDetail,
        })
      );
    },
    [dispatch]
  );

  return (
    <Box sx={{ alignSelf: 'stretch', flex: 1 }}>
      <DefineBackButton onPress={back} />
      <ExplorerList onSelect={onSelect} entries={CHESS_COMPONENT_ENTRIES} />
    </Box>
  );
}
