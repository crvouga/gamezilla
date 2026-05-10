import { ensureChessBoardExampleRegistered } from './chess-board-register-example';
import {
  useSpaceDispatch,
  useSpaceSelector,
} from '@gamezilla/spaces/client/use-space-room-selector';
import {
  CHESS_SCREEN,
  ChessMainMenuScreenAttr,
  SetChessMainMenuScreen,
  SetChessSelectedUiComponent,
} from '../shared/chess-main-menu';
import {
  Box,
  ExplorerDetail,
  IconButton,
  IconSymbol,
  Text,
  useTheme,
} from '@gamezilla/lib/ui';
import { Trans, useLingui } from '@lingui/react/macro';
import { useCallback, useEffect, type ReactNode } from 'react';

const BACK_BUTTON_SIZE = 40;
const BACK_ROW_PADDING_TOP = 12;
const BACK_ROW_PADDING_HORIZONTAL = 12;

function BackButtonRow({ onPress }: { onPress: () => void }): ReactNode {
  const { t } = useLingui();
  const theme = useTheme();
  return (
    <Box
      style={{
        alignSelf: 'stretch',
        alignItems: 'flex-start',
        height: BACK_BUTTON_SIZE + BACK_ROW_PADDING_TOP,
        paddingHorizontal: BACK_ROW_PADDING_HORIZONTAL,
        paddingTop: BACK_ROW_PADDING_TOP,
      }}
    >
      <IconButton
        size={BACK_BUTTON_SIZE}
        background="surface"
        onPress={onPress}
        accessibilityLabel={t`Back`}
      >
        <IconSymbol
          name="chevron.right"
          size={20}
          color={theme.colors.text}
          style={{ transform: [{ scaleX: -1 }] }}
        />
      </IconButton>
    </Box>
  );
}

export function ChessSettingsDeveloperUiComponentDetailScreen(): ReactNode {
  const dispatch = useSpaceDispatch();
  const selectedName = useSpaceSelector(
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
      <BackButtonRow onPress={back} />
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
        <ExplorerDetail componentName={selectedName} />
      )}
    </Box>
  );
}
