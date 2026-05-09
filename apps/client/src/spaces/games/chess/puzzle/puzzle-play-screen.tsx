import { ChessBoard } from '@gamezilla/client/spaces/games/chess/chess-board';
import {
  CHESS_SCREEN,
  SetChessMainMenuScreen,
} from '@gamezilla/domain/spaces/games/chess/chess-main-menu';
import {
  CHESS_PUZZLE_ENTITY_TYPE,
  ChessPuzzleAttr,
} from '@gamezilla/domain/spaces/games/chess/puzzle/chess-puzzle-entities';
import {
  ChessPuzzleSessionAttr,
  SelectChessPuzzle,
} from '@gamezilla/domain/spaces/games/chess/puzzle/chess-puzzle-session';
import type { PatchDbQuery } from '@gamezilla/patch-db/interface';
import {
  Box,
  Card,
  IconButton,
  IconSymbol,
  Pressable,
  Text,
  useTheme,
} from '@gamezilla/lib/ui';
import {
  useEntityAttribute,
  usePatchDbStack,
  useQuery,
} from '@gamezilla/patch-db/react';
import { Trans, useLingui } from '@lingui/react/macro';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  useSpaceDispatch,
  useSpaceSelector,
} from '../../../room/use-space-room-selector';

import type { SolveStatus } from './use-puzzle-solver';
import { usePuzzleSolver } from './use-puzzle-solver';

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
  const dispatch = useSpaceDispatch();
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

function statusLabelNode(status: SolveStatus): ReactNode {
  if (status === 'loading') return <Trans>Loading puzzle…</Trans>;
  if (status === 'solving') return <Trans>Your move</Trans>;
  if (status === 'wrong') return <Trans>Wrong — try again</Trans>;
  if (status === 'solved') return <Trans>Solved</Trans>;
  if (status === 'invalid') return <Trans>Invalid puzzle data</Trans>;
  return <Trans>Ready</Trans>;
}

function PuzzlePlayer({ puzzleId }: { puzzleId: string }): ReactNode {
  const dispatch = useSpaceDispatch();
  const { sync } = usePatchDbStack();
  /**
   * Keep this puzzle in {@link SyncPatchDb} active entity queries while playing.
   * Otherwise closing the picker tears down the list subscription and poll may
   * omit `chess.puzzle` until the next interval — play then reads empty FEN/moves
   * from the in-memory mirror until a poll merge hydrates SQLite into memory.
   */
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

  const [resetNonce, setResetNonce] = useState(0);
  const { displayFen, layoutKey, status, orientation, onMove } =
    usePuzzleSolver({
      fen,
      movesStr,
      puzzleId,
      resetNonce,
    });

  const backToPuzzleMenu = useCallback(() => {
    dispatch(SelectChessPuzzle({ puzzleId: null }));
    dispatch(SetChessMainMenuScreen({ screen: CHESS_SCREEN.puzzle }));
  }, [dispatch]);

  const themesLine =
    themes.length > 0 ? themes.slice(0, 6).join(', ') : undefined;

  return (
    <Box sx={{ alignSelf: 'stretch' }}>
      <BackButtonRow onPress={backToPuzzleMenu} />

      <Box
        sx={{
          alignSelf: 'center',
          maxWidth: BOARD_MAX_WIDTH,
          gap: 4,
          pb: 8,
          px: 4,
        }}
        style={{ width: '100%' }}
      >
        <Box sx={{ gap: 2, alignItems: 'center' }}>
          <Text
            variant="title"
            sx={{ textAlign: 'center' }}
            label={
              <Trans>
                Puzzle {puzzleId} · rating {rating}
              </Trans>
            }
          />
          {themesLine !== undefined ? (
            <Text
              variant="caption"
              sx={{ color: 'textSecondary', textAlign: 'center' }}
              label={themesLine}
            />
          ) : (
            <Text
              variant="caption"
              sx={{ color: 'textSecondary', textAlign: 'center' }}
              label={<Trans>No themes listed</Trans>}
            />
          )}
          <Text
            variant="body"
            sx={{ textAlign: 'center', opacity: 0.9 }}
            label={statusLabelNode(status)}
          />
        </Box>

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

        <Pressable
          onPress={() => {
            setResetNonce((n) => n + 1);
          }}
        >
          <Card elevation={0} sx={{ py: 3, alignItems: 'center' }}>
            <Text variant="body" label={<Trans>Reset puzzle</Trans>} />
          </Card>
        </Pressable>

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
  const selectedId = useSpaceSelector(
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
