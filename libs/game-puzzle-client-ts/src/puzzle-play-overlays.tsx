import type { PuzzleCompletion } from '@libs/game-puzzle-shared-ts/completion';
import type { SolveStatus } from '@libs/game-puzzle-shared-ts/solve-status';
import {
  type Accessor,
  createMemo,
  createSignal,
  type JSX,
  Show,
} from 'solid-js';
import { PuzzleCelebrationOverlay } from './puzzle-celebration-overlay';
import { PuzzleFeedBar } from './puzzle-feed-bar';
import { PuzzleFeedRefusedChangeNotice } from './puzzle-feed-refused-change-notice';
import { PuzzleFeedSettingsModal } from './puzzle-feed-settings-modal';

const noopRating = (): void => {};

function completionKey(completion: PuzzleCompletion): string {
  return [
    completion.outcome,
    completion.ratingBefore,
    completion.ratingAfter,
    completion.puzzleRating,
    completion.streak,
  ].join(':');
}

/** Solved, solution shown or skipped: nothing more to play on this puzzle. */
export function isPuzzleOver(status: SolveStatus): boolean {
  return status === 'solved' || status === 'revealed' || status === 'skipped';
}

function puzzleRatingOrUndef(rating: number | undefined): number | undefined {
  if (rating !== undefined && rating > 0) return rating;
  return undefined;
}

/** The feed strip and the notice for a refused feed change, under it. */
export function PuzzlePlayFeed(props: {
  puzzleId?: string | undefined;
  rating?: number | undefined;
  themes?: readonly string[] | undefined;
  status: SolveStatus;
  onOpenFeedSettings: () => void;
}): JSX.Element {
  return (
    <>
      <PuzzleFeedBar
        puzzleId={props.puzzleId}
        rating={puzzleRatingOrUndef(props.rating)}
        themes={props.themes}
        over={isPuzzleOver(props.status)}
        onOpenFeedSettings={props.onOpenFeedSettings}
      />
      <PuzzleFeedRefusedChangeNotice />
    </>
  );
}

/** The result overlay for the attempt's completion, until dismissed. */
export function CelebrationLayer(props: {
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

/** Whether the feed settings are open, and the modal that edits them. */
export function useFeedSettingsOverlay(onFeedConfigApplied: () => void): {
  readonly open: () => void;
  readonly modal: () => JSX.Element;
} {
  const [visible, setVisible] = createSignal(false);
  return {
    open: () => setVisible(true),
    modal: () => (
      <PuzzleFeedSettingsModal
        visible={visible()}
        onClose={() => setVisible(false)}
        onFeedConfigApplied={onFeedConfigApplied}
      />
    ),
  };
}
