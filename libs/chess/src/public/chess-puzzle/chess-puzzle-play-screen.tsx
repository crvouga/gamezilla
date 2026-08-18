import { DefineBackButton } from '@libs/spaces/public/nav/spaces-nav-context';
import { SpeakingAvatarAssistant } from '@pkgs/assistant/client';
import { ChessBoard } from '@pkgs/chess-board/chess-board';
import { Box, componentDataSet, SpeakingAvatar } from '@pkgs/ui';
import { memo, type ReactNode, useCallback, useState } from 'react';
import { ChessPuzzleActionBar } from './chess-puzzle-action-bar';
import { ChessPuzzleBoardFrame } from './chess-puzzle-board-frame';
import { ChessPuzzleBoardLoadingState } from './chess-puzzle-board-loading-state';
import { ChessPuzzleCelebrationOverlay } from './chess-puzzle-celebration-overlay';
import { ChessPuzzleE2EHints } from './chess-puzzle-e2e-hints';
import { ChessPuzzleE2ELoadingStatus } from './chess-puzzle-e2e-loading-status';
import { ChessPuzzleFeedBar } from './chess-puzzle-feed-bar';
import { ChessPuzzleFeedSettingsModal } from './chess-puzzle-feed-settings-modal';
import { ChessPuzzleMoveHistoryBar } from './chess-puzzle-move-history-bar';
import { ChessPuzzleStatusHeader } from './chess-puzzle-status-header';
import type { SolveStatus } from './use-chess-puzzle-solver';
import type { HintStage } from './use-hint-stage';
import { usePuzzlePlayScreenState } from './use-puzzle-play-screen-state';
import {
  type PuzzlePlayerChromeModel,
  usePuzzlePlayerState,
} from './use-puzzle-player-state';

const LOADING_SHELL_STATUS = 'loading' as const satisfies SolveStatus;
const LOADING_SHELL_HINT_STAGE = 'none' as const satisfies HintStage;

const noop = (): void => {};
const noopElo = (_rating: number): void => {};

type PuzzlePlayLayoutProps = {
  backToRoot: () => void;
  assistant: ReactNode;
  boardSlot: (size: number) => ReactNode;
  puzzleId?: string;
  puzzleRating?: number;
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
  onFeedConfigApplied: () => void;
  completion: PuzzlePlayerChromeModel['completion'];
  e2eHints?: ReactNode;
  e2eLoadingStatus?: ReactNode;
};

function PuzzlePlayLayout(p: PuzzlePlayLayoutProps): ReactNode {
  const [feedSettingsOpen, setFeedSettingsOpen] = useState(false);
  const openFeedSettings = useCallback(() => setFeedSettingsOpen(true), []);
  const closeFeedSettings = useCallback(() => setFeedSettingsOpen(false), []);
  const showCelebration = p.completion !== null;
  const puzzleRating =
    p.puzzleRating !== undefined && p.puzzleRating > 0
      ? p.puzzleRating
      : undefined;
  return (
    <Box
      sx={{ flex: 1, minHeight: 0, alignSelf: 'stretch' }}
      {...componentDataSet('ChessPuzzlePlayScreen', {
        screen: 'chess-puzzle-play',
      })}
    >
      <DefineBackButton onPress={p.backToRoot} />
      {p.e2eLoadingStatus}
      <Box sx={{ flex: 1, minHeight: 0, gap: 4, pt: 4 }}>
        <ChessPuzzleFeedBar
          puzzleId={p.puzzleId}
          rating={puzzleRating}
          onOpenFeedSettings={openFeedSettings}
        />
        {p.assistant}
        <ChessPuzzleBoardFrame
          overlay={
            showCelebration && p.completion !== null ? (
              <ChessPuzzleCelebrationOverlay
                completion={p.completion}
                onDisplayEloChange={noopElo}
              />
            ) : null
          }
        >
          {(size) => p.boardSlot(size)}
        </ChessPuzzleBoardFrame>
        <Box sx={{ alignSelf: 'stretch', gap: 2 }}>
          <ChessPuzzleMoveHistoryBar />
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
      <ChessPuzzleFeedSettingsModal
        visible={feedSettingsOpen}
        onClose={closeFeedSettings}
        onFeedConfigApplied={p.onFeedConfigApplied}
      />
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
    | 'opponentAnimating'
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
      interactive={
        p.status === 'solving' && p.atFrontier && !p.opponentAnimating
      }
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

function PuzzlePlayerChrome(
  p: PuzzlePlayerChromeModel & { onFeedConfigApplied: () => void }
): ReactNode {
  return (
    <PuzzlePlayLayout
      backToRoot={p.backToRoot}
      puzzleId={p.puzzleId}
      puzzleRating={p.rating}
      assistant={
        <SpeakingAvatarAssistant
          assistant={p.assistant}
          header={<ChessPuzzleStatusHeader kind={p.statusKind} />}
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
          opponentAnimating={p.opponentAnimating}
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
      onFeedConfigApplied={p.onFeedConfigApplied}
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
  startNonce: number;
  onRequestNext: () => void;
  onFeedConfigApplied: () => void;
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
  startNonce,
  onRequestNext,
  onFeedConfigApplied,
}: PuzzlePlayerProps): ReactNode {
  const p = usePuzzlePlayerState({
    puzzleId,
    playGeneration,
    readyGeneration,
    startNonce,
    onRequestNext,
  });
  return (
    <PuzzlePlayerChrome {...p} onFeedConfigApplied={onFeedConfigApplied} />
  );
}

function PuzzlePlayLoadingShell(p: {
  backToChessRoot: () => void;
  e2eLoadingStatus: ReactNode;
  onFeedConfigApplied: () => void;
}): ReactNode {
  return (
    <PuzzlePlayLayout
      backToRoot={p.backToChessRoot}
      e2eLoadingStatus={p.e2eLoadingStatus}
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
      onFeedConfigApplied={p.onFeedConfigApplied}
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
    startNonce,
    onRequestNext,
    reselectActivePuzzleFromFeed,
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
          onFeedConfigApplied={reselectActivePuzzleFromFeed}
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
        startNonce={startNonce}
        onRequestNext={onRequestNext}
        onFeedConfigApplied={reselectActivePuzzleFromFeed}
      />
    </Box>
  );
}
