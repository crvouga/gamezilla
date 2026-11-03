import type { PuzzleCompletion } from '@libs/game-puzzle-shared-ts/completion';
import { Handles } from '@libs/test-ids-shared-ts/handles';
import { Trans } from '@lingui/solid/macro';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { ChevronRightIcon } from '@pkgs/ui-root-client-ts/icons';
import { ResponsiveSurface } from '@pkgs/ui-root-client-ts/responsive-surface';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { Text } from '@pkgs/ui-root-client-ts/text';
import { type JSX, Match, Switch } from 'solid-js';
import { PuzzleSummaryCard } from './puzzle-summary-card';

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

export type PuzzleCelebrationOverlayViewProps = {
  readonly completion: PuzzleCompletion;
  /** The rating the summary shows: the completion's rating after. */
  readonly displayRating: number;
  /** §8 "?" marker on the player's rating while it is still uncertain. */
  readonly provisional: boolean;
  readonly visible: boolean;
  readonly onClose: () => void;
  /** §5 primary CTA: the next puzzle (large, thumb-reachable). */
  readonly onNext: () => void;
};

/**
 * The result of a finished puzzle, presentational: solved, failed or
 * abandoned, the rating it made, and the next puzzle as the main action.
 */
export function PuzzleCelebrationOverlayView(
  props: PuzzleCelebrationOverlayViewProps
): JSX.Element {
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
          displayRating={props.displayRating}
          provisional={props.provisional}
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
