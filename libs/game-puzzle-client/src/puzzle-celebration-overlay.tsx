import { useMyId } from '@libs/auth-client/use-current-user';
import type { PuzzleCompletion } from '@libs/game-puzzle-shared/completion';
import { Handles } from '@libs/test-ids-shared/handles';
import { Trans } from '@lingui/solid/macro';
import { Button } from '@pkgs/ui-root-client/button';
import { ChevronRightIcon } from '@pkgs/ui-root-client/icons';
import { ResponsiveSurface } from '@pkgs/ui-root-client/responsive-surface';
import type { Accessor, JSX } from 'solid-js';
import { PuzzleSummaryCard } from './puzzle-summary-card';
import { usePuzzleFeedback } from './use-puzzle-feedback';
import { usePuzzleProfileRatings } from './use-puzzle-profile-ratings';
import { usePuzzleRatingAnimation } from './use-puzzle-rating-animation';

function useCelebrationRatingFeedback(args: {
  completion: Accessor<PuzzleCompletion>;
  feedbackEnabled: Accessor<boolean>;
  onDisplayRatingChange: (rating: number) => void;
}): { displayRating: Accessor<number> } {
  const feedback = usePuzzleFeedback();
  return usePuzzleRatingAnimation({
    get ratingBefore() {
      return args.completion().ratingBefore;
    },
    get ratingAfter() {
      return args.completion().ratingAfter;
    },
    get animationKey() {
      const completion = args.completion();
      return `${completion.outcome}-${completion.ratingBefore}-${completion.ratingAfter}-${completion.rated}`;
    },
    enabled: true,
    onComplete: () => {
      const completion = args.completion();
      args.onDisplayRatingChange(completion.ratingAfter);
      if (args.feedbackEnabled()) feedback.onRatingComplete(completion.delta);
    },
  });
}

function celebrationTitle(outcome: PuzzleCompletion['outcome']): JSX.Element {
  if (outcome === 'solved') {
    return (
      <span class="text-success">
        <Trans>Puzzle solved!</Trans>
      </span>
    );
  }
  if (outcome === 'failed') {
    return (
      <span class="text-destructive">
        <Trans>Puzzle failed</Trans>
      </span>
    );
  }
  return <Trans>Puzzle abandoned</Trans>;
}

export type ChessPuzzleCelebrationOverlayProps = {
  completion: PuzzleCompletion;
  feedbackEnabled: Accessor<boolean>;
  visible: boolean;
  onClose: () => void;
  /** §5 primary CTA: the next puzzle (large, thumb-reachable). */
  onNext: () => void;
  onDisplayRatingChange: (rating: number) => void;
};

export function PuzzleCelebrationOverlay(
  props: ChessPuzzleCelebrationOverlayProps
): JSX.Element {
  const myId = useMyId();
  const { provisional } = usePuzzleProfileRatings(myId);
  const ratingAnim = useCelebrationRatingFeedback({
    completion: () => props.completion,
    feedbackEnabled: props.feedbackEnabled,
    onDisplayRatingChange: props.onDisplayRatingChange,
  });

  return (
    <ResponsiveSurface
      visible={props.visible}
      onClose={props.onClose}
      title={celebrationTitle(props.completion.outcome)}
      presentation="modal"
      size="small"
      closeDataSet={{ testid: Handles.chessPuzzleSummaryClose }}
      dataSet={{ testid: Handles.chessPuzzleSummary }}
    >
      <div class="box gap-4 self-stretch min-w-0">
        <PuzzleSummaryCard
          completion={props.completion}
          displayRating={ratingAnim.displayRating()}
          provisional={provisional()}
        />
        <Button
          title={<Trans>Next puzzle</Trans>}
          intent="success"
          size="lg"
          fullWidth
          endIcon={<ChevronRightIcon />}
          onClick={props.onNext}
          dataSet={{ testid: Handles.chessPuzzleSummaryNext }}
        />
      </div>
    </ResponsiveSurface>
  );
}
