import type { PuzzleCompletion } from '@libs/chess-puzzle-shared/completion';
import type { HintStage } from '@libs/chess-puzzle-shared/hint-stage';
import type { SolveStatus } from '@libs/chess-puzzle-shared/solve-status';
import { DefineBackButton } from '@libs/spaces-client/spaces-nav-context';
import {
  type Accessor,
  createMemo,
  createSignal,
  type JSX,
  Show,
} from 'solid-js';
import { ChessPuzzleActionBar } from './chess-puzzle-action-bar';
import { ChessPuzzleAllowance } from './chess-puzzle-allowance';
import { ChessPuzzleBoardFrame } from './chess-puzzle-board-frame';
import { ChessPuzzleCelebrationOverlay } from './chess-puzzle-celebration-overlay';
import { ChessPuzzleFeedBar } from './chess-puzzle-feed-bar';
import { ChessPuzzleFeedSettingsModal } from './chess-puzzle-feed-settings-modal';
import { ChessPuzzleMoveHistoryBar } from './chess-puzzle-move-history-bar';

const noopRating = (): void => {};

type PlayChromeProps = {
  layout: PuzzlePlayLayoutProps;
  openFeedSettings: () => void;
};

function completionKey(completion: PuzzleCompletion): string {
  return [
    completion.outcome,
    completion.ratingBefore,
    completion.ratingAfter,
    completion.puzzleRating,
    completion.streak,
  ].join(':');
}

/** Chrome callbacks the board well may need (feed settings live in the layout). */
export type PuzzlePlayBoardChrome = {
  readonly openFeedSettings: () => void;
};

export type PuzzlePlayLayoutProps = {
  backToRoot: () => void;
  assistant: JSX.Element;
  boardSlot: (size: number, chrome: PuzzlePlayBoardChrome) => JSX.Element;
  puzzleId?: string;
  puzzleRating?: number;
  status: Accessor<SolveStatus>;
  hintStage: Accessor<HintStage>;
  canGoBack: Accessor<boolean>;
  canGoForward: Accessor<boolean>;
  onHint: () => void;
  onSolution: () => void;
  onBack: () => void;
  onForward: () => void;
  onRetry: () => void;
  onSkip: () => void;
  onNext: () => void;
  onFeedConfigApplied: () => void;
  completion: Accessor<PuzzleCompletion | null>;
  spectator: Accessor<boolean>;
  recommendationLegend?: JSX.Element;
  testHints?: JSX.Element;
  testLoadingStatus?: JSX.Element;
};

function puzzleRatingOrUndef(rating: number | undefined): number | undefined {
  if (rating !== undefined && rating > 0) return rating;
  return undefined;
}

function PuzzlePlayFeed(props: PlayChromeProps): JSX.Element {
  return (
    <ChessPuzzleFeedBar
      puzzleId={props.layout.puzzleId}
      rating={puzzleRatingOrUndef(props.layout.puzzleRating)}
      onOpenFeedSettings={props.openFeedSettings}
    />
  );
}

function PuzzlePlayActions(props: {
  layout: PuzzlePlayLayoutProps;
}): JSX.Element {
  const p = props.layout;
  return (
    <ChessPuzzleActionBar
      status={p.status()}
      hintStage={p.hintStage()}
      canGoBack={p.canGoBack()}
      canGoForward={p.canGoForward()}
      onHint={p.onHint}
      onSolution={p.onSolution}
      onBack={p.onBack}
      onForward={p.onForward}
      onRetry={p.onRetry}
      onSkip={p.onSkip}
      onNext={p.onNext}
    />
  );
}

function PuzzlePlayBoard(props: {
  boardSlot: (size: number, chrome: PuzzlePlayBoardChrome) => JSX.Element;
  chrome: PuzzlePlayBoardChrome;
}): JSX.Element {
  return (
    <ChessPuzzleBoardFrame>
      {(size) => props.boardSlot(size, props.chrome)}
    </ChessPuzzleBoardFrame>
  );
}

/**
 * Largest square that fits the pane, flush with its edges (no inset or
 * island mat). Leftover space stays around the board (app background).
 */
function PuzzlePlayBoardWell(props: {
  boardSlot: (size: number, chrome: PuzzlePlayBoardChrome) => JSX.Element;
  chrome: PuzzlePlayBoardChrome;
}): JSX.Element {
  return (
    <div
      class="box flex-1 min-h-0 min-w-0 overflow-hidden items-center justify-center self-stretch"
      style={{ 'container-type': 'size' }}
    >
      <div
        class="box overflow-hidden min-h-0 min-w-0 shrink"
        style={{
          width: 'min(100cqw, 100cqh)',
          height: 'min(100cqw, 100cqh)',
          'max-width': '100%',
          'max-height': '100%',
        }}
      >
        <PuzzlePlayBoard boardSlot={props.boardSlot} chrome={props.chrome} />
      </div>
    </div>
  );
}

function CelebrationLayer(props: {
  completion: Accessor<PuzzleCompletion | null>;
  status: Accessor<SolveStatus>;
  onNext: () => void;
}): JSX.Element {
  const [dismissedKey, setDismissedKey] = createSignal<string | null>(null);
  const completion = createMemo(() => props.completion());
  const feedbackEnabled = createMemo((wasSolving: boolean) => {
    const status = props.status();
    return status === 'loading' || status === 'idle'
      ? false
      : status === 'solving' || wasSolving;
  }, false);
  const visible = createMemo(() => {
    const current = completion();
    if (current === null) return false;
    return dismissedKey() !== completionKey(current);
  });
  return (
    <Show when={completion()}>
      {(current) => (
        <ChessPuzzleCelebrationOverlay
          completion={current()}
          feedbackEnabled={feedbackEnabled}
          visible={visible()}
          onClose={() => setDismissedKey(completionKey(current()))}
          onNext={props.onNext}
          onDisplayRatingChange={noopRating}
        />
      )}
    </Show>
  );
}

/** Single-column: feed + coach + square board + timeline/actions. */
function PuzzlePlayStack(props: PlayChromeProps): JSX.Element {
  return (
    <div class="box flex-1 min-h-0 min-w-0 overflow-hidden">
      <div class="box shrink-0 min-w-0">
        <Show when={!props.layout.spectator()}>
          <PuzzlePlayFeed
            layout={props.layout}
            openFeedSettings={props.openFeedSettings}
          />
        </Show>
        <Show when={props.layout.spectator()}>
          <ChessPuzzleAllowance />
        </Show>
        <div class="box shrink-0 min-w-0 overflow-hidden">
          {props.layout.assistant}
        </div>
      </div>
      <PuzzlePlayBoardWell
        boardSlot={props.layout.boardSlot}
        chrome={{ openFeedSettings: props.openFeedSettings }}
      />
      {props.layout.recommendationLegend}
      <div class="box shrink-0">
        <ChessPuzzleMoveHistoryBar />
      </div>
      <div class="box self-stretch shrink-0">
        <Show when={!props.layout.spectator()}>
          <PuzzlePlayActions layout={props.layout} />
        </Show>
      </div>
    </div>
  );
}

export function PuzzlePlayLayout(props: PuzzlePlayLayoutProps): JSX.Element {
  const [feedSettingsOpen, setFeedSettingsOpen] = createSignal(false);
  const openFeedSettings = (): void => {
    setFeedSettingsOpen(true);
  };
  const closeFeedSettings = (): void => {
    setFeedSettingsOpen(false);
  };
  return (
    <div
      class="box flex-1 min-h-0 min-w-0 self-stretch overflow-hidden"
      data-testid="chess-puzzle-play-layout"
      data-screen="chess-puzzle-play"
    >
      <DefineBackButton onPress={props.backToRoot} />
      {props.testLoadingStatus}
      <PuzzlePlayStack layout={props} openFeedSettings={openFeedSettings} />
      <CelebrationLayer
        completion={props.completion}
        status={props.status}
        onNext={props.onNext}
      />
      {props.testHints}
      <ChessPuzzleFeedSettingsModal
        visible={feedSettingsOpen()}
        onClose={closeFeedSettings}
        onFeedConfigApplied={props.onFeedConfigApplied}
      />
    </div>
  );
}
