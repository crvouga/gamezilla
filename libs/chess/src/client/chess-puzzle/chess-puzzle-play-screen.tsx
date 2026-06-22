import { DefineBackButton } from '@libs/spaces/client/nav/spaces-nav-context';
import { Box } from '@pkgs/ui';
import { memo, type ReactNode } from 'react';
import { ChessBoard } from '@pkgs/chess-board/chess-board';
import { ChessPuzzleActionBar } from './chess-puzzle-action-bar';
import { ChessPuzzleBoardSkeleton } from './chess-puzzle-board-skeleton';
import { ChessPuzzleE2EHints } from './chess-puzzle-e2e-hints';
import {
  ChessPuzzleE2ELoadingStatus,
} from './chess-puzzle-e2e-loading-status';
import { ChessPuzzleSummaryOverlay } from './chess-puzzle-summary-overlay';
import { ChessPuzzleStatusHeader } from './chess-puzzle-status-header';
import { SpeakingAvatarAssistant } from '@pkgs/assistant/client';
import {
  usePuzzlePlayerState,
  type PuzzlePlayerChromeModel,
} from './use-puzzle-player-state';
import { usePuzzlePlayScreenState } from './use-puzzle-play-screen-state';

const BOARD_MAX_WIDTH = 720;

const PuzzleBoardSlot = memo(function PuzzleBoardSlot(
  p: Pick<
    PuzzlePlayerChromeModel,
    | 'displayFen'
    | 'layoutKey'
    | 'orientation'
    | 'status'
    | 'onMove'
    | 'cellFeedback'
    | 'arrows'
  >
): ReactNode {
  if (p.displayFen === null || p.displayFen.length === 0) {
    return <ChessPuzzleBoardSkeleton />;
  }
  // `cellFeedback` / `arrows` are always defined (memoized in their hooks
  // with frozen empty defaults), so we pass them unconditionally. A
  // conditional prop-spread would change the prop-bag shape every render
  // and defeat the memo on `ChessBoard`'s canvas props.
  return (
    <ChessBoard
      controlled
      testID="chess-puzzle-board"
      fen={p.displayFen}
      fenSyncKey={p.layoutKey}
      orientation={p.orientation}
      interactive={p.status === 'solving'}
      onMove={p.onMove}
      showCoordinates
      highlightLastMove
      highlightLegalMoves
      cellFeedback={p.cellFeedback}
      arrows={p.arrows}
    />
  );
});

function PuzzlePlayerChrome(p: PuzzlePlayerChromeModel): ReactNode {
  return (
    <Box sx={{ alignSelf: 'stretch' }}>
      <DefineBackButton onPress={p.backToRoot} />
      <Box
        sx={{
          alignSelf: 'center',
          maxWidth: BOARD_MAX_WIDTH,
          gap: 4,
          pb: 8,
          pt: 4,
        }}
        style={{ width: '100%' }}
      >
        <SpeakingAvatarAssistant
          assistant={p.assistant}
          header={
            <ChessPuzzleStatusHeader
              kind={p.statusKind}
              playerElo={p.playerElo}
              puzzleRating={p.rating}
            />
          }
          numberOfLines={2}
        />
        <PuzzleBoardSlot
          displayFen={p.displayFen}
          layoutKey={p.layoutKey}
          orientation={p.orientation}
          status={p.status}
          onMove={p.onMove}
          cellFeedback={p.cellFeedback}
          arrows={p.arrows}
        />
        <ChessPuzzleActionBar
          status={p.status}
          hintStage={p.hintStage}
          onHint={p.onHint}
          onRetry={p.onRetry}
          onNext={p.onNext}
        />
        {p.completion !== null ? (
          <ChessPuzzleSummaryOverlay
            completion={p.completion}
            onContinue={p.onNext}
            onRetry={p.onRetry}
          />
        ) : null}
        <ChessPuzzleE2EHints
          orientation={p.orientation}
          expectedFromSquare={p.expectedFromSquare}
          expectedToSquare={p.expectedToSquare}
        />
      </Box>
    </Box>
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
    <Box testID="chess-puzzle-play-screen" sx={{ alignSelf: 'stretch' }}>
      <DefineBackButton onPress={p.backToChessRoot} />
      {p.e2eLoadingStatus}
      <Box
        sx={{
          alignSelf: 'center',
          maxWidth: BOARD_MAX_WIDTH,
          gap: 4,
          pb: 8,
          pt: 4,
        }}
        style={{ width: '100%' }}
      >
        <ChessPuzzleBoardSkeleton />
      </Box>
    </Box>
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

  const e2ePickStatus = (
    <ChessPuzzleE2ELoadingStatus {...e2eLoadingStatus} />
  );

  // Until we have a first puzzle id, render only the skeleton in the
  // board slot's footprint — but DO NOT unmount the player once it has
  // mounted; pressing Next never re-enters this branch.
  if (activePuzzleId === null) {
    return (
      <PuzzlePlayLoadingShell
        backToChessRoot={backToChessRoot}
        e2eLoadingStatus={e2ePickStatus}
      />
    );
  }

  return (
    <Box testID="chess-puzzle-play-screen" sx={{ alignSelf: 'stretch' }}>
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
