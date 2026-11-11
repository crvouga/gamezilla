import { useMyId } from '@libs/auth-client-ts/use-current-user';
import type { PuzzleCompletion } from '@libs/game-puzzle-shared-ts/completion';
import { derivePuzzleRatingChange } from '@libs/game-puzzle-shared-ts/rating-change';
import { type Accessor, createMemo, type JSX, Show } from 'solid-js';
import { usePuzzleInteractions } from './puzzle-play-queries';
import type {
  PuzzleResultModel,
  PuzzleShownRatingChange,
} from './puzzle-play-screen-model';
import { usePuzzleFeedback } from './use-puzzle-feedback';
import type { PuzzlePlayerChromeModel } from './use-puzzle-player-state';
import { usePuzzleProfileRatings } from './use-puzzle-profile-ratings';
import { usePuzzleRatingEvents } from './use-puzzle-rating-events';
import { usePuzzleRatingFeedback } from './use-puzzle-rating-feedback';

const noopRating = (): void => {};

/** This play's rating change, from the synced ledger and interactions. */
function usePuzzleShownRatingChange(
  puzzleId: Accessor<string>
): Accessor<PuzzleShownRatingChange> {
  const events = usePuzzleRatingEvents();
  const interactions = usePuzzleInteractions(puzzleId);
  const change = createMemo(() =>
    derivePuzzleRatingChange({
      puzzleId: puzzleId(),
      interactions: interactions.rows(),
      ratingEvents: events(),
    })
  );
  return () => {
    const current = change();
    if (current.kind === 'unrated') return 'unrated';
    return current.kind === 'rated' ? current.delta : null;
  };
}

/**
 * How the attempt on the board went, for its result: the rated outcome
 * once the ledger has it, the puzzle's own rating and themes, and what the
 * attempt did to the rating (or that it is a repeat and cannot).
 */
export function usePuzzleResult(p: PuzzlePlayerChromeModel): {
  readonly model: Accessor<PuzzleResultModel>;
  readonly ratingChange: Accessor<PuzzleShownRatingChange>;
} {
  const myId = useMyId();
  const { provisional } = usePuzzleProfileRatings(myId);
  const ratingChange = usePuzzleShownRatingChange(p.puzzleId);
  const model = createMemo<PuzzleResultModel>(() => ({
    completion: p.completion(),
    displayRating: p.completion()?.ratingAfter ?? 0,
    provisional: provisional(),
    puzzleRating: Math.max(0, p.rating()),
    themes: p.themes(),
  }));
  return { model, ratingChange };
}

/** One feedback cue per distinct rated outcome, a late rating included. */
function RatingFeedback(props: {
  readonly completion: Accessor<PuzzleCompletion>;
  readonly enabled: Accessor<boolean>;
}): JSX.Element {
  const feedback = usePuzzleFeedback();
  usePuzzleRatingFeedback({
    completion: props.completion,
    feedbackEnabled: props.enabled,
    onDisplayRatingChange: noopRating,
    onRatingComplete: feedback.onRatingComplete,
  });
  return null;
}

/**
 * The rating's feedback cue for a puzzle finished on this board: played
 * for an attempt that was being solved here, never for one restored
 * already over.
 */
export function PuzzleResultFeedback(props: {
  readonly model: PuzzlePlayerChromeModel;
}): JSX.Element {
  const enabled = createMemo((wasSolving: boolean) => {
    const status = props.model.status();
    return status === 'loading' || status === 'idle'
      ? false
      : status === 'solving' || wasSolving;
  }, false);
  return (
    <Show when={props.model.completion()}>
      {(current) => <RatingFeedback completion={current} enabled={enabled} />}
    </Show>
  );
}
