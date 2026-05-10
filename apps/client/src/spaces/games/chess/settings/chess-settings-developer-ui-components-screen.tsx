import { ensureChessBoardExampleRegistered } from '@gamezilla/client/spaces/games/chess/chess-board/register-example';
import { useSpaceDispatch } from '@gamezilla/client/spaces/room/use-space-room-selector';
import {
  CHESS_SCREEN,
  SetChessMainMenuScreen,
  SetChessSelectedUiComponent,
} from '@gamezilla/domain/spaces/games/chess/chess-main-menu';
import {
  Box,
  ExplorerList,
  IconButton,
  IconSymbol,
  useTheme,
} from '@gamezilla/lib/ui';
import { useLingui } from '@lingui/react/macro';
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

export function ChessSettingsDeveloperUiComponentsScreen(): ReactNode {
  const dispatch = useSpaceDispatch();

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
      <BackButtonRow onPress={back} />
      <ExplorerList onSelect={onSelect} />
    </Box>
  );
}
