import { useMyId } from '@libs/auth-client-ts/use-current-user';
import type { PuzzleCompletion } from '@libs/game-puzzle-shared-ts/completion';
import type { Accessor, JSX } from 'solid-js';
import { PuzzleCelebrationOverlayView } from './puzzle-celebration-overlay-view';
import { usePuzzleFeedback } from './use-puzzle-feedback';
import { usePuzzleProfileRatings } from './use-puzzle-profile-ratings';
import { usePuzzleRatingFeedback } from './use-puzzle-rating-feedback';

export type PuzzleCelebrationOverlayProps = {
  completion: PuzzleCompletion;
  feedbackEnabled: Accessor<boolean>;
  visible: boolean;
  onClose: () => void;
  /** §5 primary CTA: the next puzzle (large, thumb-reachable). */
  onNext: () => void;
  onDisplayRatingChange: (rating: number) => void;
};

/** The result overlay, wired to the profile rating and the result feedback. */
export function PuzzleCelebrationOverlay(
  props: PuzzleCelebrationOverlayProps
): JSX.Element {
  const myId = useMyId();
  const { provisional } = usePuzzleProfileRatings(myId);
  const feedback = usePuzzleFeedback();
  const ratingAnim = usePuzzleRatingFeedback({
    completion: () => props.completion,
    feedbackEnabled: props.feedbackEnabled,
    onDisplayRatingChange: props.onDisplayRatingChange,
    onRatingComplete: feedback.onRatingComplete,
  });
  return (
    <PuzzleCelebrationOverlayView
      completion={props.completion}
      displayRating={ratingAnim.displayRating()}
      provisional={provisional()}
      visible={props.visible}
      onClose={props.onClose}
      onNext={props.onNext}
    />
  );
}
