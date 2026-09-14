import { Trans } from '@lingui/solid/macro';
import { ResponsiveSurface } from '@pkgs/ui';
import type { Accessor, JSX } from 'solid-js';

import { ChessPuzzleSummaryCard } from './chess-puzzle-summary-card';
import type { PuzzleCompletion } from './use-chess-puzzle-completion';
import { useChessPuzzleEloAnimation } from './use-chess-puzzle-elo-animation';
import { useChessPuzzleFeedback } from './use-chess-puzzle-feedback';

function useCelebrationEloFeedback(args: {
  completion: PuzzleCompletion;
  onDisplayEloChange: (rating: number) => void;
}): { displayRating: Accessor<number> } {
  const feedback = useChessPuzzleFeedback();
  const completionKey = `${args.completion.outcome}-${args.completion.ratingAfter}`;

  return useChessPuzzleEloAnimation({
    ratingBefore: args.completion.ratingBefore,
    ratingAfter: args.completion.ratingAfter,
    animationKey: completionKey,
    enabled: true,
    onComplete: () => {
      args.onDisplayEloChange(args.completion.ratingAfter);
      feedback.onEloComplete(args.completion.delta);
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
  return <Trans>Puzzle abandoned</Trans>;
}

export type ChessPuzzleCelebrationOverlayProps = {
  completion: PuzzleCompletion;
  visible: boolean;
  onClose: () => void;
  onDisplayEloChange: (rating: number) => void;
};

export function ChessPuzzleCelebrationOverlay(
  props: ChessPuzzleCelebrationOverlayProps
): JSX.Element {
  const eloAnim = useCelebrationEloFeedback({
    completion: props.completion,
    onDisplayEloChange: props.onDisplayEloChange,
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
      <ChessPuzzleSummaryCard
        completion={props.completion}
        displayRating={eloAnim.displayRating()}
      />
    </ResponsiveSurface>
  );
}
