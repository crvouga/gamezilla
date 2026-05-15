import { SpeakingAvatarAssistant } from '@gamezilla/assistant/client';
import { useMyId } from '@gamezilla/auth/client/use-current-user';
import { AbacEntityAttr } from '@gamezilla/patch-db/abac/abac-entity-attr';
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
import { Box, IconButton, IconSymbol, Text, useTheme } from '@gamezilla/ui';
import { Trans, useLingui } from '@lingui/react/macro';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  CHESS_SCREEN,
  SetChessMainMenuScreen,
} from '../../shared/chess-main-menu';
import {
  CHESS_PUZZLE_ENTITY_TYPE,
  ChessPuzzleAttr,
} from '../../shared/chess-puzzle-entities';
import {
  CHESS_PUZZLE_INTERACTION_ENTITY_TYPE,
  ChessPuzzleInteractionAttr,
  interactionRowFromEntityAttributes,
  type ChessPuzzleInteractionRow,
} from '../../shared/chess-puzzle-interaction-entities';
import {
  CHESS_PUZZLE_PLAY_STATUS,
  ChessPuzzlePlayAttr,
  ClearChessPuzzlePlay,
  RequestChessPuzzleHint,
  ResetChessPuzzlePlay,
  StartChessPuzzlePlay,
} from '../../shared/chess-puzzle-play';
import { ChessBoard } from '../chess-board/chess-board';
import type { Square } from '../chess-board/chess-board-types';
import { useChessPuzzleAssistant } from '../assistant/use-chess-puzzle-assistant';
import { ChessPuzzleActionBar } from './chess-puzzle-action-bar';
import { deriveChessPuzzleCellFeedback } from './chess-puzzle-cell-feedback';
import { uciFromMove } from './chess-puzzle-play-chess-utils';
import { chessPuzzleStatusKindFromState } from './chess-puzzle-status-from-state';
import { ChessPuzzleStatusHeader } from './chess-puzzle-status-header';
import { useChessPuzzleInteractionRecorder } from './use-chess-puzzle-interaction-recorder';
import { useNextPuzzleId } from './use-next-puzzle-id';
import { usePuzzleSolver } from './use-chess-puzzle-solver';

const BOARD_MAX_WIDTH = 720;
const BACK_BUTTON_SIZE = 40;
const BACK_ROW_PADDING_TOP = 12;
const BACK_ROW_PADDING_HORIZONTAL = 12;
const CORRECT_FLASH_MS = 1500;

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

function usePuzzleInteractions(puzzleId: string): ChessPuzzleInteractionRow[] {
  const myId = useMyId();
  const query = useMemo(
    (): PatchDbQuery => ({
      entityType: CHESS_PUZZLE_INTERACTION_ENTITY_TYPE,
      where: {
        type: 'and',
        clauses: [
          {
            type: '=',
            attribute: AbacEntityAttr.owner.key,
            value: myId,
          },
          {
            type: '=',
            attribute: ChessPuzzleInteractionAttr.puzzleId.key,
            value: puzzleId,
          },
        ],
      },
      orderBy: [
        {
          attribute: ChessPuzzleInteractionAttr.at.key,
          direction: 'asc',
        },
      ],
      limit: 100,
    }),
    [myId, puzzleId]
  );
  const result = useQuery(query);
  return useMemo(
    () =>
      result.entities.map((e) =>
        interactionRowFromEntityAttributes(e.attributes)
      ),
    [result.entities]
  );
}

function LoadingFirstPuzzle(): ReactNode {
  return (
    <Box
      sx={{
        alignSelf: 'stretch',
        gap: 4,
        px: 4,
        pt: 8,
        alignItems: 'center',
      }}
    >
      <Text
        variant="body"
        sx={{ color: 'textSecondary', textAlign: 'center' }}
        label={<Trans>Loading puzzle…</Trans>}
      />
    </Box>
  );
}

type PuzzlePlayerProps = {
  puzzleId: string;
  onRequestNext: () => void;
};

function PuzzlePlayer({
  puzzleId,
  onRequestNext,
}: PuzzlePlayerProps): ReactNode {
  const dispatch = useSpaceRoomDispatch();
  const { fen, movesStr, rating, themes } = usePuzzleEntity(puzzleId);
  const interactions = usePuzzleInteractions(puzzleId);

  const {
    displayFen,
    layoutKey,
    status,
    orientation,
    onMove: onMoveRaw,
    solveIdx,
    wrongFromSquare,
    wrongToSquare,
    expectedFromSquare,
  } = usePuzzleSolver({ fen, movesStr, puzzleId });

  const { appendUsedHint, appendAbandoned, setLastUci } =
    useChessPuzzleInteractionRecorder({
      puzzleId,
      puzzleRating: rating,
      status,
      solveIdx,
      interactions,
    });

  const prevSolveIdxRef = useRef(solveIdx);
  const [showCorrectFlash, setShowCorrectFlash] = useState(false);
  const [solvedCrownSquare, setSolvedCrownSquare] = useState<Square | null>(
    null
  );

  useEffect(() => {
    if (
      status === CHESS_PUZZLE_PLAY_STATUS.solving &&
      solveIdx > prevSolveIdxRef.current &&
      prevSolveIdxRef.current > 0
    ) {
      setShowCorrectFlash(true);
      const t = setTimeout(() => setShowCorrectFlash(false), CORRECT_FLASH_MS);
      prevSolveIdxRef.current = solveIdx;
      return () => clearTimeout(t);
    }
    prevSolveIdxRef.current = solveIdx;
    return undefined;
  }, [solveIdx, status]);

  useEffect(() => {
    if (status !== CHESS_PUZZLE_PLAY_STATUS.solved) return;
    const fenParts = (displayFen ?? '').split(/\s+/);
    const side = fenParts[1] === 'b' ? 'w' : 'b';
    const kingSq = side === 'w' ? 'e1' : 'e8';
    setSolvedCrownSquare(kingSq as Square);
    const t = setTimeout(() => setSolvedCrownSquare(null), CORRECT_FLASH_MS);
    return () => clearTimeout(t);
  }, [displayFen, status]);

  const onMove = useCallback(
    (m: Parameters<typeof onMoveRaw>[0]) => {
      setLastUci(uciFromMove(m));
      onMoveRaw(m);
    },
    [onMoveRaw, setLastUci]
  );

  const assistant = useChessPuzzleAssistant({
    puzzleId,
    status,
    solveIdx,
    themes,
    layoutKey,
  });

  const statusKind = chessPuzzleStatusKindFromState({
    status,
    orientation,
    showCorrectFlash,
  });

  const cellFeedback = useMemo(
    () =>
      deriveChessPuzzleCellFeedback({
        status,
        puzzleId,
        interactions,
        wrongFromSquare,
        wrongToSquare,
        expectedFromSquare,
        showSolvedCrownOn: solvedCrownSquare,
      }),
    [
      status,
      puzzleId,
      interactions,
      wrongFromSquare,
      wrongToSquare,
      expectedFromSquare,
      solvedCrownSquare,
    ]
  );

  const backToRoot = useCallback(() => {
    dispatch(ClearChessPuzzlePlay({}));
    dispatch(SetChessMainMenuScreen({ screen: CHESS_SCREEN.root }));
  }, [dispatch]);

  const onHint = useCallback(() => {
    dispatch(RequestChessPuzzleHint({}));
    void appendUsedHint();
  }, [appendUsedHint, dispatch]);

  const onRetry = useCallback(() => {
    if (status !== CHESS_PUZZLE_PLAY_STATUS.solved) {
      void appendAbandoned();
    }
    dispatch(ResetChessPuzzlePlay({}));
  }, [appendAbandoned, dispatch, status]);

  const onNext = useCallback(async () => {
    if (status !== CHESS_PUZZLE_PLAY_STATUS.solved) {
      await appendAbandoned();
    }
    dispatch(ClearChessPuzzlePlay({}));
    onRequestNext();
  }, [appendAbandoned, dispatch, onRequestNext, status]);

  return (
    <Box sx={{ alignSelf: 'stretch' }}>
      <BackButtonRow onPress={backToRoot} />
      <Box
        sx={{
          alignSelf: 'center',
          maxWidth: BOARD_MAX_WIDTH,
          gap: 4,
          pb: 8,
        }}
        style={{ width: '100%' }}
      >
        <SpeakingAvatarAssistant
          assistant={assistant}
          header={<ChessPuzzleStatusHeader kind={statusKind} rating={rating} />}
          numberOfLines={2}
        />
        <ChessBoard
          controlled
          fen={displayFen ?? ''}
          fenSyncKey={layoutKey}
          orientation={orientation}
          interactive={status === 'solving'}
          onMove={onMove}
          showCoordinates
          highlightLastMove
          highlightLegalMoves
          cellFeedback={cellFeedback}
        />
        <ChessPuzzleActionBar
          status={status}
          onHint={onHint}
          onRetry={onRetry}
          onNext={() => void onNext()}
        />
      </Box>
    </Box>
  );
}

export function PuzzlePlayScreen(): ReactNode {
  const myId = useMyId();
  const dispatch = useSpaceRoomDispatch();
  const roomStatus = useSpaceRoomSelector(ChessPuzzlePlayAttr.status.from);
  const roomPuzzleId = useSpaceRoomSelector(ChessPuzzlePlayAttr.puzzleId.from);

  const [activePuzzleId, setActivePuzzleId] = useState<string | null>(null);
  const [attemptSeed, setAttemptSeed] = useState(0);

  const { puzzleId: nextId, loading: nextLoading } = useNextPuzzleId({
    currentPuzzleId: activePuzzleId ?? roomPuzzleId,
    seed: `${myId}-${attemptSeed}`,
  });

  useEffect(() => {
    if (activePuzzleId !== null) return;
    if (roomPuzzleId !== null) {
      setActivePuzzleId(roomPuzzleId);
      return;
    }
    if (nextId !== null) {
      setActivePuzzleId(nextId);
    }
  }, [activePuzzleId, nextId, roomPuzzleId]);

  const { fen, movesStr } = usePuzzleEntity(activePuzzleId ?? '');

  useEffect(() => {
    if (activePuzzleId === null) return;
    if (roomStatus !== CHESS_PUZZLE_PLAY_STATUS.idle) return;
    if (fen.length === 0 || movesStr.length === 0) return;
    dispatch(
      StartChessPuzzlePlay({
        puzzleId: activePuzzleId,
        fen,
        moves: movesStr,
      })
    );
  }, [activePuzzleId, dispatch, fen, movesStr, roomStatus]);

  const onRequestNext = useCallback(() => {
    setActivePuzzleId(null);
    setAttemptSeed((s) => s + 1);
  }, []);

  useEffect(() => {
    if (activePuzzleId !== null) return;
    if (nextId !== null) {
      setActivePuzzleId(nextId);
    }
  }, [activePuzzleId, nextId]);

  if (nextLoading || activePuzzleId === null) {
    return (
      <Box sx={{ alignSelf: 'stretch' }}>
        <LoadingFirstPuzzle />
      </Box>
    );
  }

  return (
    <PuzzlePlayer
      key={activePuzzleId}
      puzzleId={activePuzzleId}
      onRequestNext={onRequestNext}
    />
  );
}
