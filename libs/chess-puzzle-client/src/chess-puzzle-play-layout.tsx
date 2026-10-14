import type { PuzzleCompletion } from '@libs/chess-puzzle-shared/completion';
import type { HintStage } from '@libs/chess-puzzle-shared/hint-stage';
import type { SolveStatus } from '@libs/chess-puzzle-shared/solve-status';
import { DefineBackButton } from '@libs/spaces-client/spaces-nav-context';
import { PuzzleScreen } from '@pkgs/ui-root-client/puzzle-screen';
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
  overlay?: JSX.Element;
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
  puzzleThemes?: readonly string[];
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
  /** The live region someone listening to the app hears. */
  announcement?: JSX.Element;
};

/** Solved, solution shown or skipped: nothing more to play on this puzzle. */
function isPuzzleOver(status: SolveStatus): boolean {
  return status === 'solved' || status === 'revealed' || status === 'skipped';
}

function puzzleRatingOrUndef(rating: number | undefined): number | undefined {
  if (rating !== undefined && rating > 0) return rating;
  return undefined;
}

function PuzzlePlayFeed(props: PlayChromeProps): JSX.Element {
  return (
    <ChessPuzzleFeedBar
      puzzleId={props.layout.puzzleId}
      rating={puzzleRatingOrUndef(props.layout.puzzleRating)}
      themes={props.layout.puzzleThemes}
      over={isPuzzleOver(props.layout.status())}
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
    <PuzzleScreen
      screenId="chess-puzzle-play"
      dataSet={{ testid: 'chess-puzzle-play-layout' }}
      header={
        <>
          <Show when={!props.layout.spectator()}>
            <PuzzlePlayFeed
              layout={props.layout}
              openFeedSettings={props.openFeedSettings}
            />
          </Show>
          <Show when={props.layout.spectator()}>
            <ChessPuzzleAllowance />
          </Show>
          {props.layout.assistant}
        </>
      }
      overlay={props.overlay}
      legend={props.layout.recommendationLegend}
      timeline={<ChessPuzzleMoveHistoryBar />}
      actions={
        <Show when={!props.layout.spectator()}>
          <PuzzlePlayActions layout={props.layout} />
        </Show>
      }
    >
      <PuzzlePlayBoard
        boardSlot={props.layout.boardSlot}
        chrome={{ openFeedSettings: props.openFeedSettings }}
      />
    </PuzzleScreen>
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
    <>
      <DefineBackButton onPress={props.backToRoot} />
      <PuzzlePlayStack
        layout={props}
        openFeedSettings={openFeedSettings}
        overlay={
          <>
            {props.announcement}
            {props.testLoadingStatus}
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
          </>
        }
      />
    </>
  );
}
