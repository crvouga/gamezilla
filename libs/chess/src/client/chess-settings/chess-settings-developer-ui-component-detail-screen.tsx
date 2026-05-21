import { DefineBackButton } from '@libs/spaces/client/nav/spaces-nav-context';
import {
  useSpaceRoomDispatch,
  useSpaceRoomSelector,
} from '@libs/spaces/client/room/use-space-room-selector';
import { Box, ExplorerDetail, Text } from '@pkgs/ui';
import { Trans } from '@lingui/react/macro';
import { useCallback, useEffect, type ReactNode } from 'react';
import {
  CHESS_SCREEN,
  ChessMainMenuScreenAttr,
  SetChessMainMenuScreen,
  SetChessSelectedUiComponent,
} from '../../shared/chess-main-menu';
import {
  CHESS_COMPONENT_ENTRIES,
  ensureChessBoardExampleRegistered,
} from '../chess-board/chess-board-register-example';

export function ChessSettingsDeveloperUiComponentDetailScreen(): ReactNode {
  const dispatch = useSpaceRoomDispatch();
  const selectedName = useSpaceRoomSelector(
    ChessMainMenuScreenAttr.selectedUiComponentName.from
  );

  /**
   * Idempotent: ensures the chess board example is registered so it can be
   * looked up directly when this screen is the first to mount (e.g. via deep
   * link or reload while a chess UI component was selected).
   */
  useEffect(() => {
    ensureChessBoardExampleRegistered();
  }, []);

  const back = useCallback(() => {
    dispatch(SetChessSelectedUiComponent({ name: null }));
    dispatch(
      SetChessMainMenuScreen({ screen: CHESS_SCREEN.settingsDeveloperUi })
    );
  }, [dispatch]);

  return (
    <Box sx={{ alignSelf: 'stretch' }} style={{ flex: 1 }}>
      <DefineBackButton onPress={back} />
      {selectedName === null ? (
        <Box sx={{ p: 4, gap: 2, alignItems: 'center' }}>
          <Text variant="title" label={<Trans>No component selected</Trans>} />
          <Text
            variant="caption"
            sx={{ color: 'textSecondary' }}
            label={<Trans>Pick one from the previous screen.</Trans>}
          />
        </Box>
      ) : (
        <ExplorerDetail
          componentName={selectedName}
          entries={CHESS_COMPONENT_ENTRIES}
        />
      )}
    </Box>
  );
}
