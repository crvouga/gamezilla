import { SpeakingAvatarAssistant } from '@pkgs/assistant/client';
import { ChessBoard } from '@pkgs/chess-board/chess-board';
import { Box, SpeakingAvatar } from '@pkgs/ui';
import { type Accessor, type JSX, Show } from 'solid-js';

import type { HintStage } from '../../shared/puzzle-session/hint-stage';
import { ChessPuzzleBoardLoadingState } from './chess-puzzle-board-loading-state';
import { ChessPuzzleE2EHints } from './chess-puzzle-e2e-hints';
import { ChessPuzzleE2ELoadingStatus } from './chess-puzzle-e2e-loading-status';
import { PuzzlePlayLayout } from './chess-puzzle-play-layout';
import { ChessPuzzleStatusHeader } from './chess-puzzle-status-header';
import type { SolveStatus } from './use-chess-puzzle-solver';
import { usePuzzlePlayScreenState } from './use-puzzle-play-screen-state';
import {
  type PuzzlePlayerChromeModel,
  usePuzzlePlayerState,
} from './use-puzzle-player-state';

const LOADING_SHELL_STATUS = 'loading' as const satisfies SolveStatus;
const LOADING_SHELL_HINT_STAGE = 'none' as const satisfies HintStage;

const noop = (): void => {};

function PuzzleBoardSlot(props: {
  size: number;
  displayFen: Accessor<string | null>;
  layoutKey: Accessor<number>;
  orientation: Accessor<'white' | 'black'>;
  status: Accessor<SolveStatus>;
  atFrontier: Accessor<boolean>;
  opponentAnimating: Accessor<boolean>;
  onMove: (
    m: Parameters<NonNullable<Parameters<typeof ChessBoard>[0]['onMove']>>[0]
  ) => void;
  cellFeedback: PuzzlePlayerChromeModel['cellFeedback'];
  cellHighlights: PuzzlePlayerChromeModel['cellHighlights'];
  arrows: PuzzlePlayerChromeModel['arrows'];
}): JSX.Element {
  return (
    <Show
      when={props.displayFen() !== null && props.displayFen()!.length > 0}
      fallback={<ChessPuzzleBoardLoadingState size={props.size} />}
    >
      <ChessBoard
        controlled
        dataSet={{ testid: 'chess-puzzle-board' }}
        size={props.size}
        fen={props.displayFen() ?? ''}
        fenSyncKey={props.layoutKey()}
        orientation={props.orientation()}
        interactive={
          props.status() === 'solving' &&
          props.atFrontier() &&
          !props.opponentAnimating()
        }
        onMove={props.onMove}
        showCoordinates
        highlightLastMove
        highlightLegalMoves
        cellFeedback={props.cellFeedback()}
        cellHighlights={props.cellHighlights()}
        arrows={props.arrows()}
      />
    </Show>
  );
}

function PuzzlePlayerChrome(props: {
  model: PuzzlePlayerChromeModel;
  onFeedConfigApplied: () => void;
}): JSX.Element {
  const p = props.model;
  return (
    <PuzzlePlayLayout
      backToRoot={p.backToRoot}
      puzzleId={p.puzzleId()}
      puzzleRating={p.rating()}
      assistant={
        <SpeakingAvatarAssistant
          assistant={p.assistant()}
          header={<ChessPuzzleStatusHeader kind={p.statusKind()} />}
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
      onFeedConfigApplied={props.onFeedConfigApplied}
      completion={p.completion}
      e2eHints={
        <ChessPuzzleE2EHints
          orientation={p.orientation}
          status={p.status}
          solveIdx={p.solveIdx}
          moves={p.movesStr}
          interactive={() =>
            p.status() === 'solving' && p.atFrontier() && !p.opponentAnimating()
          }
          solutionUci={p.solutionUci}
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

function PuzzlePlayer(props: PuzzlePlayerProps): JSX.Element {
  const p = usePuzzlePlayerState({
    puzzleId: props.puzzleId,
    playGeneration: props.playGeneration,
    readyGeneration: props.readyGeneration,
    startNonce: props.startNonce,
    onRequestNext: props.onRequestNext,
  });
  return (
    <PuzzlePlayerChrome
      model={p}
      onFeedConfigApplied={props.onFeedConfigApplied}
    />
  );
}

function PuzzlePlayLoadingShell(props: {
  backToChessRoot: () => void;
  e2eLoadingStatus: JSX.Element;
  onFeedConfigApplied: () => void;
}): JSX.Element {
  return (
    <PuzzlePlayLayout
      backToRoot={props.backToChessRoot}
      e2eLoadingStatus={props.e2eLoadingStatus}
      assistant={
        <SpeakingAvatar
          message=""
          bubbleResolving
          header={<ChessPuzzleStatusHeader kind="loading" />}
          numberOfLines={2}
        />
      }
      boardSlot={(size) => <ChessPuzzleBoardLoadingState size={size} />}
      status={() => LOADING_SHELL_STATUS}
      hintStage={() => LOADING_SHELL_HINT_STAGE}
      canGoBack={() => false}
      canGoForward={() => false}
      onHint={noop}
      onSolution={noop}
      onBack={noop}
      onForward={noop}
      onRetry={noop}
      onNext={noop}
      onFeedConfigApplied={props.onFeedConfigApplied}
      completion={() => null}
    />
  );
}

export function PuzzlePlayScreen(): JSX.Element {
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

  const e2ePickStatus = <ChessPuzzleE2ELoadingStatus {...e2eLoadingStatus()} />;

  return (
    <Box
      dataSet={{ testid: 'chess-puzzle-play-screen' }}
      sx={{ flex: 1, minHeight: 0, alignSelf: 'stretch' }}
    >
      <Show
        when={activePuzzleId() !== null}
        fallback={
          <PuzzlePlayLoadingShell
            backToChessRoot={backToChessRoot}
            e2eLoadingStatus={e2ePickStatus}
            onFeedConfigApplied={reselectActivePuzzleFromFeed}
          />
        }
      >
        {e2ePickStatus}
        <PuzzlePlayer
          puzzleId={activePuzzleId()!}
          playGeneration={attemptSeed()}
          readyGeneration={readyGeneration()}
          startNonce={startNonce()}
          onRequestNext={onRequestNext}
          onFeedConfigApplied={reselectActivePuzzleFromFeed}
        />
      </Show>
    </Box>
  );
}
