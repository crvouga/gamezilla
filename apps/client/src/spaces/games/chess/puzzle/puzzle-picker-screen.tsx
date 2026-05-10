import {
  CHESS_SCREEN,
  SetChessMainMenuScreen,
} from '@gamezilla/domain/spaces/games/chess/chess-main-menu';
import { ClearChessPuzzlePlay } from '@gamezilla/domain/spaces/games/chess/puzzle/chess-puzzle-play';
import { SelectChessPuzzle } from '@gamezilla/domain/spaces/games/chess/puzzle/chess-puzzle-session';
import { Box, IconButton, IconSymbol, Text, useTheme } from '@gamezilla/lib/ui';
import { RoomMetaAttr } from '@gamezilla/room';
import { Trans, useLingui } from '@lingui/react/macro';
import { useCallback, type ReactNode } from 'react';
import {
  useSpaceDispatch,
  useSpaceSelector,
} from '../../../room/use-space-room-selector';
import { PuzzlePicker } from './puzzle-picker';

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

export function PuzzlePickerScreen(): ReactNode {
  const dispatch = useSpaceDispatch();
  const isSynced = useSpaceSelector(RoomMetaAttr.isSynced.from);

  const backToPuzzleMenu = useCallback(() => {
    dispatch(SetChessMainMenuScreen({ screen: CHESS_SCREEN.puzzle }));
  }, [dispatch]);

  const onPickPuzzle = useCallback(
    (puzzleId: string) => {
      dispatch(ClearChessPuzzlePlay({}));
      dispatch(SelectChessPuzzle({ puzzleId }));
      dispatch(SetChessMainMenuScreen({ screen: CHESS_SCREEN.puzzlePlay }));
    },
    [dispatch]
  );

  const notice = !isSynced ? (
    <Text
      variant="caption"
      sx={{ color: 'textSecondary', textAlign: 'center' }}
      label={<Trans>Waiting for space sync…</Trans>}
    />
  ) : undefined;

  return (
    <Box sx={{ alignSelf: 'stretch', flex: 1 }}>
      <BackButtonRow onPress={backToPuzzleMenu} />
      <PuzzlePicker onPickPuzzle={onPickPuzzle} notice={notice} />
    </Box>
  );
}
