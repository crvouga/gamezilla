import { DefineBackButton } from '@libs/spaces/client/nav/spaces-nav-context';
import { SpeakingAvatarAssistant } from '@pkgs/assistant/client';
import { Box, SpeakingAvatar } from '@pkgs/ui';
import { ChessBoard } from '@pkgs/chess-board/chess-board';
import { memo, useCallback, useEffect, useState, type ReactNode } from 'react';
import { ChessPuzzleActionBar } from './chess-puzzle-action-bar';
import { ChessPuzzleBoardFrame } from './chess-puzzle-board-frame';
import { ChessPuzzleBoardLoadingState } from './chess-puzzle-board-loading-state';
import { ChessPuzzleCelebrationOverlay } from './chess-puzzle-celebration-overlay';
import { ChessPuzzleE2EHints } from './chess-puzzle-e2e-hints';
import { ChessPuzzleE2ELoadingStatus } from './chess-puzzle-e2e-loading-status';
import { ChessPuzzleStatusHeader } from './chess-puzzle-status-header';
import type { HintStage } from './use-hint-stage';
import type { SolveStatus } from './use-chess-puzzle-solver';
import {
  usePuzzlePlayerState,
  type PuzzlePlayerChromeModel,
} from './use-puzzle-player-state';
import { usePuzzlePlayScreenState } from './use-puzzle-play-screen-state';

const LOADING_SHELL_STATUS = 'loading' as const satisfies SolveStatus;
const LOADING_SHELL_HINT_STAGE = 'none' as const satisfies HintStage;

const noop = (): void => {};

type PuzzlePlayLayoutProps = {
  backToRoot: () => void;
  assistant: ReactNode;
  boardSlot: (size: number) => ReactNode;
  status: SolveStatus;
  hintStage: HintStage;
  canGoBack: boolean;
  canGoForward: boolean;
  onHint: () => void;
  onSolution: () => void;
  onBack: () => void;
  onForward: () => void;
  onRetry: () => void;
  onNext: () => void;
  completion: PuzzlePlayerChromeModel['completion'];
  onCelebrationEloChange: (rating: number) => void;
  onCelebrationEloComplete: () => void;
  e2eHints?: ReactNode;
  e2eLoadingStatus?: ReactNode;
};

function PuzzlePlayLayout(p: PuzzlePlayLayoutProps): ReactNode {
  const showCelebration = p.completion !== null;
  return (
    <Box sx={{ flex: 1, minHeight: 0, alignSelf: 'stretch' }}>
      <DefineBackButton onPress={p.backToRoot} />
      {p.e2eLoadingStatus}
      <Box sx={{ flex: 1, minHeight: 0, gap: 4, pt: 4 }}>
        {p.assistant}
        <ChessPuzzleBoardFrame
          overlay={
            showCelebration && p.completion !== null ? (
              <ChessPuzzleCelebrationOverlay
                completion={p.completion}
                onDisplayEloChange={p.onCelebrationEloChange}
                onEloCompletePulse={p.onCelebrationEloComplete}
              />
            ) : null
          }
        >
          {(size) => p.boardSlot(size)}
        </ChessPuzzleBoardFrame>
        <Box sx={{ alignSelf: 'stretch' }}>
          <ChessPuzzleActionBar
            status={p.status}
            hintStage={p.hintStage}
            canGoBack={p.canGoBack}
            canGoForward={p.canGoForward}
            onHint={p.onHint}
            onSolution={p.onSolution}
            onBack={p.onBack}
            onForward={p.onForward}
            onRetry={p.onRetry}
            onNext={p.onNext}
          />
        </Box>
        {p.e2eHints}
      </Box>
    </Box>
  );
}

const PuzzleBoardSlot = memo(function PuzzleBoardSlot(
  p: Pick<
    PuzzlePlayerChromeModel,
    | 'displayFen'
    | 'layoutKey'
    | 'orientation'
    | 'status'
    | 'atFrontier'
    | 'onMove'
    | 'cellFeedback'
    | 'cellHighlights'
    | 'arrows'
  > & { size: number }
): ReactNode {
  if (p.displayFen === null || p.displayFen.length === 0) {
    return <ChessPuzzleBoardLoadingState size={p.size} />;
  }
  return (
    <ChessBoard
      controlled
      testID="chess-puzzle-board"
      size={p.size}
      fen={p.displayFen}
      fenSyncKey={p.layoutKey}
      orientation={p.orientation}
      interactive={p.status === 'solving' && p.atFrontier}
      onMove={p.onMove}
      showCoordinates
      highlightLastMove
      highlightLegalMoves
      cellFeedback={p.cellFeedback}
      cellHighlights={p.cellHighlights}
      arrows={p.arrows}
    />
  );
});

function PuzzlePlayerChrome(p: PuzzlePlayerChromeModel): ReactNode {
  const [celebrationElo, setCelebrationElo] = useState<number | null>(null);
  const [eloPulseNonce, setEloPulseNonce] = useState(0);

  useEffect(() => {
    if (p.completion === null) {
      setCelebrationElo(null);
      setEloPulseNonce(0);
    }
  }, [p.completion]);

  const onCelebrationEloChange = useCallback((rating: number) => {
    setCelebrationElo(rating);
  }, []);

  const onCelebrationEloComplete = useCallback(() => {
    setEloPulseNonce((n) => n + 1);
  }, []);

  const headerPlayerElo = celebrationElo ?? p.playerElo;

  return (
    <PuzzlePlayLayout
      backToRoot={p.backToRoot}
      onCelebrationEloChange={onCelebrationEloChange}
      onCelebrationEloComplete={onCelebrationEloComplete}
      assistant={
        <SpeakingAvatarAssistant
          assistant={p.assistant}
          header={
            <ChessPuzzleStatusHeader
              kind={p.statusKind}
              playerElo={headerPlayerElo}
              puzzleRating={p.rating}
              playerEloPulseNonce={eloPulseNonce}
            />
          }
          numberOfLines={2}
        />
      }
      boardSlot={(size) => (
        <PuzzleBoardSlot
          size={size}
          displayFen={p.displayFen}
          layoutKey={p.layoutKey}
          orientation={p.orientation}
          status={p.status}
          atFrontier={p.atFrontier}
          onMove={p.onMove}
          cellFeedback={p.cellFeedback}
          cellHighlights={p.cellHighlights}
          arrows={p.arrows}
        />
      )}
      status={p.status}
      hintStage={p.hintStage}
      canGoBack={p.canGoBack}
      canGoForward={p.canGoForward}
      onHint={p.onHint}
      onSolution={p.onSolution}
      onBack={p.onBack}
      onForward={p.onForward}
      onRetry={p.onRetry}
      onNext={p.onNext}
      completion={p.completion}
      e2eHints={
        <ChessPuzzleE2EHints
          orientation={p.orientation}
          expectedFromSquare={p.expectedFromSquare}
          expectedToSquare={p.expectedToSquare}
        />
      }
    />
  );
}

type PuzzlePlayerProps = {
  puzzleId: string;
  playGeneration: number;
  readyGeneration: number;
  onRequestNext: () => void;
};

/**
 * The player itself is the long-lived component: it owns the Skia board,
 * the chess.js game instance, the assistant, and all per-attempt local
 * state. Cycling puzzles updates the `puzzleId` prop in place — the
 * component instance survives, so we never tear down + rebuild the Skia
 * canvas, re-rasterize the piece SVGs, or replay the slide-from-zero
 * mount animation.
 */
function PuzzlePlayer({
  puzzleId,
  playGeneration,
  readyGeneration,
  onRequestNext,
}: PuzzlePlayerProps): ReactNode {
  const p = usePuzzlePlayerState({
    puzzleId,
    playGeneration,
    readyGeneration,
    onRequestNext,
  });
  return <PuzzlePlayerChrome {...p} />;
}

function PuzzlePlayLoadingShell(p: {
  backToChessRoot: () => void;
  e2eLoadingStatus: ReactNode;
}): ReactNode {
  return (
    <PuzzlePlayLayout
      backToRoot={p.backToChessRoot}
      e2eLoadingStatus={p.e2eLoadingStatus}
      onCelebrationEloChange={noop}
      onCelebrationEloComplete={noop}
      assistant={
        <SpeakingAvatar
          message=""
          bubbleResolving
          header={<ChessPuzzleStatusHeader kind="loading" />}
          numberOfLines={2}
        />
      }
      boardSlot={(size) => <ChessPuzzleBoardLoadingState size={size} />}
      status={LOADING_SHELL_STATUS}
      hintStage={LOADING_SHELL_HINT_STAGE}
      canGoBack={false}
      canGoForward={false}
      onHint={noop}
      onSolution={noop}
      onBack={noop}
      onForward={noop}
      onRetry={noop}
      onNext={noop}
      completion={null}
    />
  );
}

export function PuzzlePlayScreen(): ReactNode {
  const {
    backToChessRoot,
    activePuzzleId,
    attemptSeed,
    readyGeneration,
    onRequestNext,
    e2eLoadingStatus,
  } = usePuzzlePlayScreenState();

  const e2ePickStatus = <ChessPuzzleE2ELoadingStatus {...e2eLoadingStatus} />;

  if (activePuzzleId === null) {
    return (
      <Box
        testID="chess-puzzle-play-screen"
        sx={{ flex: 1, minHeight: 0, alignSelf: 'stretch' }}
      >
        <PuzzlePlayLoadingShell
          backToChessRoot={backToChessRoot}
          e2eLoadingStatus={e2ePickStatus}
        />
      </Box>
    );
  }

  return (
    <Box
      testID="chess-puzzle-play-screen"
      sx={{ flex: 1, minHeight: 0, alignSelf: 'stretch' }}
    >
      {e2ePickStatus}
      <PuzzlePlayer
        puzzleId={activePuzzleId}
        playGeneration={attemptSeed}
        readyGeneration={readyGeneration}
        onRequestNext={onRequestNext}
      />
    </Box>
  );
}
