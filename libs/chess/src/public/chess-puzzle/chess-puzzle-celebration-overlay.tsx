import { Trans } from '@lingui/solid/macro';
import { useClock } from '@pkgs/clock/solid';
import { ResponsiveSurface } from '@pkgs/ui';
import { type Accessor, createEffect, type JSX } from 'solid-js';

import { shouldPlayEloTick } from '../../shared/puzzle-session/elo-tick';
import { ChessPuzzleSummaryCard } from './chess-puzzle-summary-card';
import type { PuzzleCompletion } from './use-chess-puzzle-completion';
import { useChessPuzzleEloAnimation } from './use-chess-puzzle-elo-animation';
import { useChessPuzzleFeedback } from './use-chess-puzzle-feedback';

function useCelebrationEloFeedback(args: {
  completion: PuzzleCompletion;
  onDisplayEloChange: (rating: number) => void;
  onEloCompletePulse?: () => void;
}): { displayRating: Accessor<number>; completePulse: Accessor<number> } {
  const feedback = useChessPuzzleFeedback();
  const clock = useClock();
  const lastTickAtRef: { current: number } = { current: 0 };
  const lastTickRatingRef: { current: number } = {
    current: args.completion.ratingBefore,
  };
  const completionKey = `${args.completion.outcome}-${args.completion.ratingAfter}`;

  const onRatingStep = (rating: number): void => {
    args.onDisplayEloChange(rating);
    const now = clock.now();
    if (
      shouldPlayEloTick({
        nextRating: rating,
        prevDisplayedRating: lastTickRatingRef.current,
        lastTickAtMs: lastTickAtRef.current,
        nowMs: now,
      })
    ) {
      lastTickAtRef.current = now;
      lastTickRatingRef.current = rating;
      feedback.onEloTick();
    }
  };

  const onComplete = (): void => {
    args.onDisplayEloChange(args.completion.ratingAfter);
    feedback.onEloComplete(args.completion.delta);
    args.onEloCompletePulse?.();
  };

  const anim = useChessPuzzleEloAnimation({
    ratingBefore: args.completion.ratingBefore,
    ratingAfter: args.completion.ratingAfter,
    animationKey: completionKey,
    enabled: true,
    onRatingStep,
    onComplete,
  });

  createEffect(() => {
    args.onDisplayEloChange(args.completion.ratingBefore);
  });

  return anim;
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
  onEloCompletePulse?: () => void;
};

export function ChessPuzzleCelebrationOverlay(
  props: ChessPuzzleCelebrationOverlayProps
): JSX.Element {
  const eloAnim = useCelebrationEloFeedback({
    completion: props.completion,
    onDisplayEloChange: props.onDisplayEloChange,
    ...(props.onEloCompletePulse !== undefined
      ? { onEloCompletePulse: props.onEloCompletePulse }
      : {}),
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
        deltaPulse={eloAnim.completePulse}
      />
    </ResponsiveSurface>
  );
}
