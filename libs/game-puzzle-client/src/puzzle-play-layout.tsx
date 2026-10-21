import type { PuzzleCompletion } from '@libs/game-puzzle-shared/completion';
import type { HintStage } from '@libs/game-puzzle-shared/hint-stage';
import type { SolveStatus } from '@libs/game-puzzle-shared/solve-status';
import { DefineBackButton } from '@libs/spaces-client/spaces-nav-context';
import { Handles } from '@libs/test-ids-shared/handles';
import { BoardFit } from '@pkgs/ui-root-client/board-fit';
import { PuzzleScreen } from '@pkgs/ui-root-client/puzzle-screen';
import {
  type Accessor,
  createMemo,
  createSignal,
  type JSX,
  Show,
} from 'solid-js';
import { PuzzleActionBar } from './puzzle-action-bar';
import { PuzzleAllowance } from './puzzle-allowance';
import { PuzzleCelebrationOverlay } from './puzzle-celebration-overlay';
import { PuzzleFeedBar } from './puzzle-feed-bar';
import { PuzzleFeedRefusedChangeNotice } from './puzzle-feed-refused-change-notice';
import { PuzzleFeedSettingsModal } from './puzzle-feed-settings-modal';
import { PuzzleMoveHistoryBar } from './puzzle-move-history-bar';

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
  testLoadingStatus?: JSX.Element;
  /** The game's companion to the attempt (its live region, its probes). */
  companion?: JSX.Element;
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
    <>
      <PuzzleFeedBar
        puzzleId={props.layout.puzzleId}
        rating={puzzleRatingOrUndef(props.layout.puzzleRating)}
        themes={props.layout.puzzleThemes}
        over={isPuzzleOver(props.layout.status())}
        onOpenFeedSettings={props.openFeedSettings}
      />
      <PuzzleFeedRefusedChangeNotice />
    </>
  );
}

function PuzzlePlayActions(props: {
  layout: PuzzlePlayLayoutProps;
}): JSX.Element {
  const p = props.layout;
  return (
    <PuzzleActionBar
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
    <BoardFit testId={Handles.chessPuzzleBoardFrame}>
      {(size) => props.boardSlot(size, props.chrome)}
    </BoardFit>
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
        <PuzzleCelebrationOverlay
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
            <PuzzleAllowance />
          </Show>
          {props.layout.assistant}
        </>
      }
      overlay={props.overlay}
      legend={props.layout.recommendationLegend}
      timeline={<PuzzleMoveHistoryBar />}
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
            {props.companion}
            {props.testLoadingStatus}
            <CelebrationLayer
              completion={props.completion}
              status={props.status}
              onNext={props.onNext}
            />
            <PuzzleFeedSettingsModal
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
