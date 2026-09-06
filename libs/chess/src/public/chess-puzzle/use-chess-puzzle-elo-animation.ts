import { startTiming } from '@pkgs/ui-rn/animation/run-timing';
import { USE_NATIVE_DRIVER } from '@pkgs/ui-rn/animation/use-native-driver';
import { motion } from '@pkgs/ui-rn/theme/motion';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing } from 'react-native';

const COUNT_UP_MS = 1200;

function runCompletePulse(completePulse: Animated.Value): void {
  startTiming(
    completePulse,
    {
      toValue: 1.12,
      duration: motion.duration.fast,
      useNativeDriver: USE_NATIVE_DRIVER,
    },
    () => {
      startTiming(completePulse, {
        toValue: 1,
        duration: motion.duration.fast,
        useNativeDriver: USE_NATIVE_DRIVER,
      });
    }
  );
}

export function useChessPuzzleEloAnimation(args: {
  ratingBefore: number;
  ratingAfter: number;
  animationKey: string;
  enabled: boolean;
  onRatingStep?: (rating: number) => void;
  onComplete?: () => void;
}): {
  displayRating: number;
  completePulse: Animated.Value;
} {
  const {
    ratingBefore,
    ratingAfter,
    animationKey,
    enabled,
    onRatingStep,
    onComplete,
  } = args;
  const progress = useRef(new Animated.Value(0)).current;
  const completePulse = useRef(new Animated.Value(1)).current;
  const [displayRating, setDisplayRating] = useState(ratingBefore);
  const lastReportedRef = useRef(ratingBefore);

  useEffect(() => {
    if (!enabled) {
      setDisplayRating(ratingBefore);
      lastReportedRef.current = ratingBefore;
      return;
    }
    progress.setValue(0);
    completePulse.setValue(1);
    setDisplayRating(ratingBefore);
    lastReportedRef.current = ratingBefore;

    const report = (next: number): void => {
      setDisplayRating(next);
      if (next === lastReportedRef.current) return;
      lastReportedRef.current = next;
      onRatingStep?.(next);
    };

    const listenerId = progress.addListener(({ value }) => {
      report(Math.round(ratingBefore + (ratingAfter - ratingBefore) * value));
    });

    Animated.timing(progress, {
      toValue: 1,
      duration: COUNT_UP_MS,
      easing: Easing.bezier(0, 0, 0, 1),
      useNativeDriver: USE_NATIVE_DRIVER,
    }).start(({ finished }) => {
      if (!finished) return;
      report(ratingAfter);
      onComplete?.();
      runCompletePulse(completePulse);
    });

    return () => {
      progress.removeListener(listenerId);
    };
  }, [
    animationKey,
    completePulse,
    enabled,
    onComplete,
    onRatingStep,
    progress,
    ratingAfter,
    ratingBefore,
  ]);

  return { displayRating, completePulse };
}
