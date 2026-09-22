import { useMyId } from '@libs/auth/public/use-current-user';
import { Trans } from '@lingui/solid/macro';
import { Button, ChevronRightIcon, ResponsiveSurface } from '@pkgs/ui';
import type { Accessor, JSX } from 'solid-js';
import { ChessPuzzleSummaryCard } from './chess-puzzle-summary-card';
import type { PuzzleCompletion } from './use-chess-puzzle-completion';
import { useChessPuzzleFeedback } from './use-chess-puzzle-feedback';
import { useChessPuzzleProfileRatings } from './use-chess-puzzle-profile-ratings';
import { useChessPuzzleRatingAnimation } from './use-chess-puzzle-rating-animation';

function useCelebrationRatingFeedback(args: {
  completion: PuzzleCompletion;
  onDisplayRatingChange: (rating: number) => void;
}): { displayRating: Accessor<number> } {
  const feedback = useChessPuzzleFeedback();
  const completionKey = `${args.completion.outcome}-${args.completion.ratingAfter}`;

  return useChessPuzzleRatingAnimation({
    ratingBefore: args.completion.ratingBefore,
    ratingAfter: args.completion.ratingAfter,
    animationKey: completionKey,
    enabled: true,
    onComplete: () => {
      args.onDisplayRatingChange(args.completion.ratingAfter);
      feedback.onRatingComplete(args.completion.delta);
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
  visible: boolean;
  onClose: () => void;
  /** §5 primary CTA: the next puzzle (large, thumb-reachable). */
  onNext: () => void;
  onDisplayRatingChange: (rating: number) => void;
};

export function ChessPuzzleCelebrationOverlay(
  props: ChessPuzzleCelebrationOverlayProps
): JSX.Element {
  const myId = useMyId();
  const { provisional } = useChessPuzzleProfileRatings(myId);
  const ratingAnim = useCelebrationRatingFeedback({
    completion: props.completion,
    onDisplayRatingChange: props.onDisplayRatingChange,
  });

  return (
    <ResponsiveSurface
      visible={props.visible}
      onClose={props.onClose}
      title={celebrationTitle(props.completion.outcome)}
      presentation="modal"
      size="small"
      closeDataSet={{ testid: 'chess-puzzle-summary-close' }}
      dataSet={{ testid: 'chess-puzzle-summary' }}
    >
      <div class="box gap-4 self-stretch min-w-0">
        <ChessPuzzleSummaryCard
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
          dataSet={{ testid: 'chess-puzzle-summary-next' }}
        />
      </div>
    </ResponsiveSurface>
  );
}
