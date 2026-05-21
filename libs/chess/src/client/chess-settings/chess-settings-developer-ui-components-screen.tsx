import { DefineBackButton } from '@gamezilla/spaces/client/nav/spaces-nav-context';
import { useSpaceRoomDispatch } from '@gamezilla/spaces/client/room/use-space-room-selector';
import { Box, ExplorerList } from '@gamezilla/ui';
import { useCallback, useEffect, type ReactNode } from 'react';
import {
  CHESS_SCREEN,
  SetChessMainMenuScreen,
  SetChessSelectedUiComponent,
} from '../../shared/chess-main-menu';
import {
  CHESS_COMPONENT_ENTRIES,
  ensureChessBoardExampleRegistered,
} from '../chess-board/chess-board-register-example';

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
    <Box sx={{ alignSelf: 'stretch' }} style={{ flex: 1 }}>
      <DefineBackButton onPress={back} />
      <ExplorerList onSelect={onSelect} entries={CHESS_COMPONENT_ENTRIES} />
    </Box>
  );
}
