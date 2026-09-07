import { useClock } from '@pkgs/clock/solid';
import { Box, useTheme } from '@pkgs/ui';
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
    <Box
      sx={{
        position: 'absolute',
        inset: 0,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 12,
      }}
    >
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          backgroundColor: 'rgba(0,0,0,0.55)',
          opacity: overlayAnim.scrimOpacity(),
          transitionProperty: 'opacity',
          transitionDuration: 'var(--ui-duration-fast)',
          pointerEvents: 'none',
        }}
      />
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          backgroundColor: theme.colors.successSurface,
          opacity: overlayAnim.vignetteOpacity(),
          transitionProperty: 'opacity',
          transitionDuration: 'var(--ui-duration-slower)',
          transitionTimingFunction: 'var(--ui-easing-inOut)',
          pointerEvents: 'none',
        }}
      />
      <Box
        dataSet={{ testid: 'chess-puzzle-summary' }}
        sx={{
          alignSelf: 'stretch',
          opacity: overlayAnim.cardOpacity(),
          transform: [{ scale: overlayAnim.cardScale() }],
          transitionProperty: 'opacity, transform',
          transitionDuration: 'var(--ui-duration-slow)',
          transitionTimingFunction: 'var(--ui-easing-decelerate)',
        }}
      >
        <ChessPuzzleSummaryCard
          completion={props.completion}
          displayRating={eloAnim.displayRating()}
          deltaPulse={eloAnim.completePulse}
        />
      </Box>
    </Box>
  );
}
