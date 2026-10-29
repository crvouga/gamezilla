import { useMyId } from '@libs/auth-client-ts/use-current-user';
import type { PuzzleCompletion } from '@libs/game-puzzle-shared-ts/completion';
import { Handles } from '@libs/test-ids-shared-ts/handles';
import { Trans } from '@lingui/solid/macro';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { ChevronRightIcon } from '@pkgs/ui-root-client-ts/icons';
import { ResponsiveSurface } from '@pkgs/ui-root-client-ts/responsive-surface';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { Text } from '@pkgs/ui-root-client-ts/text';
import { type Accessor, type JSX, Match, Switch } from 'solid-js';
import { PuzzleSummaryCard } from './puzzle-summary-card';
import { usePuzzleFeedback } from './use-puzzle-feedback';
import { usePuzzleProfileRatings } from './use-puzzle-profile-ratings';
import { usePuzzleRatingFeedback } from './use-puzzle-rating-feedback';

/** Solved in the success tone, failed in the destructive one. */
function CelebrationTitle(props: {
  outcome: PuzzleCompletion['outcome'];
}): JSX.Element {
  return (
    <Switch fallback={<Trans>Puzzle abandoned</Trans>}>
      <Match when={props.outcome === 'solved'}>
        <Text variant="inherit" tone="success">
          <Trans>Puzzle solved!</Trans>
        </Text>
      </Match>
      <Match when={props.outcome === 'failed'}>
        <Text variant="inherit" tone="destructive">
          <Trans>Puzzle failed</Trans>
        </Text>
      </Match>
    </Switch>
  );
}

export type PuzzleCelebrationOverlayProps = {
  completion: PuzzleCompletion;
  feedbackEnabled: Accessor<boolean>;
  visible: boolean;
  onClose: () => void;
  /** §5 primary CTA: the next puzzle (large, thumb-reachable). */
  onNext: () => void;
  onDisplayRatingChange: (rating: number) => void;
};

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
    <ResponsiveSurface
      visible={props.visible}
      onClose={props.onClose}
      title={<CelebrationTitle outcome={props.completion.outcome} />}
      presentation="modal"
      size="small"
      closeDataSet={{ testid: Handles.chessPuzzleSummaryClose }}
      dataSet={{ testid: Handles.chessPuzzleSummary }}
    >
      <StackVertical gap="lg" self="stretch">
        <PuzzleSummaryCard
          completion={props.completion}
          displayRating={ratingAnim.displayRating()}
          provisional={provisional()}
        />
        <Button
          title={<Trans>Next puzzle</Trans>}
          size="lg"
          fullWidth
          endIcon={<ChevronRightIcon />}
          onClick={props.onNext}
          dataSet={{ testid: Handles.chessPuzzleSummaryNext }}
        />
      </StackVertical>
    </ResponsiveSurface>
  );
}
