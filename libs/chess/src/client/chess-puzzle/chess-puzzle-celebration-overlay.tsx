import { useClock } from '@pkgs/clock';
import { useTheme } from '@pkgs/ui';
import { type ReactNode, useCallback, useEffect, useRef } from 'react';
import { Animated } from 'react-native';

import { ChessPuzzleSummaryCard } from './chess-puzzle-summary-card';
import { shouldPlayEloTick } from './throttle-elo-tick';
import { useCelebrationOverlayAnimation } from './use-celebration-overlay-animation';
import type { PuzzleCompletion } from './use-chess-puzzle-completion';
import { useChessPuzzleEloAnimation } from './use-chess-puzzle-elo-animation';
import { useChessPuzzleFeedback } from './use-chess-puzzle-feedback';

function CelebrationScrim(p: {
  scrimOpacity: Animated.Value;
  vignetteOpacity: Animated.Value;
  vignetteColor: string;
}): ReactNode {
  return (
    <>
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          bottom: 0,
          left: 0,
          backgroundColor: 'rgba(0,0,0,0.55)',
          opacity: p.scrimOpacity,
        }}
      />
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          bottom: 0,
          left: 0,
          backgroundColor: p.vignetteColor,
          opacity: p.vignetteOpacity,
        }}
      />
    </>
  );
}

function useCelebrationEloFeedback(args: {
  completion: PuzzleCompletion;
  onDisplayEloChange: (rating: number) => void;
  onEloCompletePulse?: () => void;
}): {
  displayRating: number;
  completePulse: Animated.Value;
} {
  const { completion, onDisplayEloChange, onEloCompletePulse } = args;
  const feedback = useChessPuzzleFeedback();
  const clock = useClock();
  const lastTickAtRef = useRef(0);
  const lastTickRatingRef = useRef(completion.ratingBefore);
  const completionKey = `${completion.outcome}-${completion.ratingAfter}`;

  const onRatingStep = useCallback(
    (rating: number) => {
      onDisplayEloChange(rating);
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
    },
    [clock, feedback, onDisplayEloChange]
  );

  const onComplete = useCallback(() => {
    onDisplayEloChange(completion.ratingAfter);
    feedback.onEloComplete(completion.delta);
    onEloCompletePulse?.();
  }, [
    completion.delta,
    completion.ratingAfter,
    feedback,
    onDisplayEloChange,
    onEloCompletePulse,
  ]);

  const anim = useChessPuzzleEloAnimation({
    ratingBefore: completion.ratingBefore,
    ratingAfter: completion.ratingAfter,
    animationKey: completionKey,
    enabled: true,
    onRatingStep,
    onComplete,
  });

  useEffect(() => {
    onDisplayEloChange(completion.ratingBefore);
  }, [completion.ratingBefore, onDisplayEloChange]);

  return anim;
}

export type ChessPuzzleCelebrationOverlayProps = {
  completion: PuzzleCompletion;
  onDisplayEloChange: (rating: number) => void;
  onEloCompletePulse?: () => void;
};

export function ChessPuzzleCelebrationOverlay(
  p: ChessPuzzleCelebrationOverlayProps
): ReactNode {
  const theme = useTheme();
  const completionKey = `${p.completion.outcome}-${p.completion.ratingAfter}`;
  const overlayAnim = useCelebrationOverlayAnimation(completionKey);
  const eloAnim = useCelebrationEloFeedback({
    completion: p.completion,
    onDisplayEloChange: p.onDisplayEloChange,
    ...(p.onEloCompletePulse !== undefined
      ? { onEloCompletePulse: p.onEloCompletePulse }
      : {}),
  });

  return (
    <Animated.View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 12,
      }}
    >
      <CelebrationScrim
        scrimOpacity={overlayAnim.scrimOpacity}
        vignetteOpacity={overlayAnim.vignetteOpacity}
        vignetteColor={theme.colors.successSurface}
      />
      <Animated.View
        testID="chess-puzzle-summary"
        style={{
          alignSelf: 'stretch',
          opacity: overlayAnim.cardOpacity,
          transform: [{ scale: overlayAnim.cardScale }],
        }}
      >
        <ChessPuzzleSummaryCard
          completion={p.completion}
          displayRating={eloAnim.displayRating}
          deltaPulse={eloAnim.completePulse}
        />
      </Animated.View>
    </Animated.View>
  );
}
