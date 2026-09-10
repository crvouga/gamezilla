import { useClock } from '@pkgs/clock/solid';
import { useTheme } from '@pkgs/ui';
import { type Accessor, createEffect, type JSX } from 'solid-js';

import { shouldPlayEloTick } from '../../shared/puzzle-session/elo-tick';
import { ChessPuzzleSummaryCard } from './chess-puzzle-summary-card';
import { useCelebrationOverlayAnimation } from './use-celebration-overlay-animation';
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

export type ChessPuzzleCelebrationOverlayProps = {
  completion: PuzzleCompletion;
  onDisplayEloChange: (rating: number) => void;
  onEloCompletePulse?: () => void;
};

export function ChessPuzzleCelebrationOverlay(
  props: ChessPuzzleCelebrationOverlayProps
): JSX.Element {
  const theme = useTheme();
  const completionKey = `${props.completion.outcome}-${props.completion.ratingAfter}`;
  const overlayAnim = useCelebrationOverlayAnimation(completionKey);
  const eloAnim = useCelebrationEloFeedback({
    completion: props.completion,
    onDisplayEloChange: props.onDisplayEloChange,
    ...(props.onEloCompletePulse !== undefined
      ? { onEloCompletePulse: props.onEloCompletePulse }
      : {}),
  });

  return (
    <div class="box absolute inset-[0] justify-center items-center [padding-left:12px;padding-right:12px]">
      <div
        class="box absolute inset-[0] bg-[rgba(0,0,0,0.55)] [transition-property:opacity] [transition-duration:var(--ui-duration-fast)] pointer-events-none"
        style={{ opacity: overlayAnim.scrimOpacity() }}
      />
      <div
        class="box absolute inset-[0] [transition-property:opacity] [transition-duration:var(--ui-duration-slower)] [transition-timing-function:var(--ui-easing-inOut)] pointer-events-none"
        style={{
          'background-color': theme.colors.successSurface,
          opacity: overlayAnim.vignetteOpacity(),
        }}
      />
      <div
        class="box self-stretch [transition-property:opacity,_transform] [transition-duration:var(--ui-duration-slow)] [transition-timing-function:var(--ui-easing-decelerate)]"
        style={{
          transform: `scale(${overlayAnim.cardScale()})`,
          opacity: overlayAnim.cardOpacity(),
        }}
        data-testid="chess-puzzle-summary"
      >
        <ChessPuzzleSummaryCard
          completion={props.completion}
          displayRating={eloAnim.displayRating()}
          deltaPulse={eloAnim.completePulse}
        />
      </div>
    </div>
  );
}
