import type { PatchDbQuery } from '@gamezilla/patch-db/interface';
import {
  useEntityAttribute,
  useQuery,
  useSync,
} from '@gamezilla/patch-db/react';
import {
  useSpaceRoomDispatch,
  useSpaceRoomSelector,
} from '@gamezilla/spaces/client/room/use-space-room-selector';
import {
  Box,
  Card,
  IconButton,
  IconSymbol,
  Pressable,
  SpeakingAvatar,
  Text,
  useTheme,
} from '@gamezilla/ui';
import { Trans, useLingui } from '@lingui/react/macro';
import { useCallback, useEffect, useMemo, type ReactNode } from 'react';
import {
  CHESS_SCREEN,
  SetChessMainMenuScreen,
} from '../../shared/chess-main-menu';
import {
  CHESS_PUZZLE_ENTITY_TYPE,
  ChessPuzzleAttr,
} from '../../shared/chess-puzzle-entities';
import {
  ClearChessPuzzlePlay,
  ResetChessPuzzlePlay,
} from '../../shared/chess-puzzle-play';
import {
  ChessPuzzleSessionAttr,
  SelectChessPuzzle,
} from '../../shared/chess-puzzle-session';
import { ChessBoard } from '../chess-board/chess-board';

import { getPuzzlePlayDialog } from './chess-puzzle-play-dialog';
import { usePuzzleSolver } from './use-chess-puzzle-solver';
import { usePuzzleDialogEvent } from './use-puzzle-dialog-event';

const BOARD_MAX_WIDTH = 720;
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

function EmptyPickPuzzle(): ReactNode {
  const dispatch = useSpaceRoomDispatch();
  const theme = useTheme();
  const openPicker = useCallback(() => {
    dispatch(SetChessMainMenuScreen({ screen: CHESS_SCREEN.puzzlePicker }));
  }, [dispatch]);
  const backMenu = useCallback(() => {
    dispatch(SetChessMainMenuScreen({ screen: CHESS_SCREEN.puzzle }));
  }, [dispatch]);

  return (
    <Box sx={{ alignSelf: 'stretch', gap: 4, px: 4, pt: 4 }}>
      <Text
        variant="title"
        sx={{ textAlign: 'center' }}
        label={<Trans>No puzzle selected</Trans>}
      />
      <Text
        variant="body"
        sx={{ color: 'textSecondary', textAlign: 'center' }}
        label={<Trans>Open the picker to choose a puzzle from PatchDB.</Trans>}
      />
      <Pressable onPress={openPicker}>
        <Card elevation={0} sx={{ py: 4, alignItems: 'center' }}>
          <Text variant="body" label={<Trans>Open puzzle picker</Trans>} />
        </Card>
      </Pressable>
      <Pressable onPress={backMenu}>
        <Card elevation={0} sx={{ py: 4, alignItems: 'center' }}>
          <Text
            variant="body"
            sx={{ color: theme.colors.textSecondary }}
            label={<Trans>Back to puzzle menu</Trans>}
          />
        </Card>
      </Pressable>
    </Box>
  );
}

/**
 * Keep this puzzle in {@link SyncPatchDb} active entity queries while playing.
 * Otherwise closing the picker tears down the list subscription and poll may
 * omit `chess.puzzle` until the next interval — play then reads empty FEN/moves
 * from the in-memory mirror until a poll merge hydrates SQLite into memory.
 */
function usePuzzleEntity(puzzleId: string): {
  fen: string;
  movesStr: string;
  rating: number;
  themes: readonly string[];
} {
  const sync = useSync();
  const selectedPuzzleSyncQuery = useMemo(
    (): PatchDbQuery => ({
      entityType: CHESS_PUZZLE_ENTITY_TYPE,
      where: {
        type: '=',
        attribute: ChessPuzzleAttr.id.key,
        value: puzzleId,
      },
      limit: 1,
    }),
    [puzzleId]
  );
  void useQuery(selectedPuzzleSyncQuery);

  useEffect(() => {
    void sync.runPollNow();
  }, [puzzleId, sync]);

  const fen = useEntityAttribute(
    CHESS_PUZZLE_ENTITY_TYPE,
    puzzleId,
    ChessPuzzleAttr.fen
  );
  const movesStr = useEntityAttribute(
    CHESS_PUZZLE_ENTITY_TYPE,
    puzzleId,
    ChessPuzzleAttr.moves
  );
  const rating = useEntityAttribute(
    CHESS_PUZZLE_ENTITY_TYPE,
    puzzleId,
    ChessPuzzleAttr.rating
  );
  const themes = useEntityAttribute(
    CHESS_PUZZLE_ENTITY_TYPE,
    puzzleId,
    ChessPuzzleAttr.themes
  );

  return { fen, movesStr, rating, themes };
}

function ResetPuzzleButton({ onPress }: { onPress: () => void }): ReactNode {
  return (
    <Pressable onPress={onPress}>
      <Card elevation={0} sx={{ py: 3, alignItems: 'center' }}>
        <Text variant="body" label={<Trans>Reset puzzle</Trans>} />
      </Card>
    </Pressable>
  );
}

function PuzzlePlayer({ puzzleId }: { puzzleId: string }): ReactNode {
  const dispatch = useSpaceRoomDispatch();
  const { i18n } = useLingui();
  const { fen, movesStr, themes } = usePuzzleEntity(puzzleId);

  const { displayFen, layoutKey, status, orientation, onMove, solveIdx } =
    usePuzzleSolver({ fen, movesStr, puzzleId });

  const dialogEvent = usePuzzleDialogEvent({ status, solveIdx });
  // `dialogEvent === null` while the puzzle is loading. Pass an empty
  // string so `SpeakingAvatar` stays mounted (the bubble's fixed height
  // keeps the chess board from shifting) but says nothing.
  const coachMessage =
    dialogEvent !== null
      ? i18n._(getPuzzlePlayDialog(dialogEvent, themes))
      : '';

  const backToPuzzleMenu = useCallback(() => {
    dispatch(ClearChessPuzzlePlay({}));
    dispatch(SelectChessPuzzle({ puzzleId: null }));
    dispatch(SetChessMainMenuScreen({ screen: CHESS_SCREEN.puzzle }));
  }, [dispatch]);

  const onResetPuzzle = useCallback(() => {
    dispatch(ResetChessPuzzlePlay({}));
  }, [dispatch]);

  return (
    <Box sx={{ alignSelf: 'stretch' }}>
      <BackButtonRow onPress={backToPuzzleMenu} />
      <Box
        sx={{
          alignSelf: 'center',
          maxWidth: BOARD_MAX_WIDTH,
          gap: 4,
          pb: 8,
        }}
        style={{ width: '100%' }}
      >
        <SpeakingAvatar message={coachMessage} />
        <ChessBoard
          controlled
          fen={displayFen ?? ''}
          fenSyncKey={layoutKey}
          orientation={orientation}
          interactive={status === 'solving' || status === 'wrong'}
          onMove={onMove}
          showCoordinates
          highlightLastMove
          highlightLegalMoves
        />
        <ResetPuzzleButton onPress={onResetPuzzle} />
        <Text
          variant="caption"
          sx={{ color: 'textSecondary', textAlign: 'center' }}
          label={<Trans>Drag or tap pieces. Play the solution line.</Trans>}
        />
      </Box>
    </Box>
  );
}

export function PuzzlePlayScreen(): ReactNode {
  const selectedId = useSpaceRoomSelector(
    ChessPuzzleSessionAttr.selectedPuzzleId.from
  );
  if (selectedId === null) {
    return (
      <Box sx={{ alignSelf: 'stretch' }}>
        <EmptyPickPuzzle />
      </Box>
    );
  }
  return <PuzzlePlayer key={selectedId} puzzleId={selectedId} />;
}
