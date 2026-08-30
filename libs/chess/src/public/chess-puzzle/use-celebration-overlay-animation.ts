import { snapAnimatedValue, startTiming } from '@pkgs/ui/animation/run-timing';
import { USE_NATIVE_DRIVER } from '@pkgs/ui/animation/use-native-driver';
import { motion } from '@pkgs/ui/theme/motion';
import { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';

type OverlayValues = {
  scrimOpacity: Animated.Value;
  cardOpacity: Animated.Value;
  cardScale: Animated.Value;
  vignetteOpacity: Animated.Value;
};

function snapCelebration(values: OverlayValues): void {
  snapAnimatedValue(values.scrimOpacity, 1);
  snapAnimatedValue(values.cardOpacity, 1);
  snapAnimatedValue(values.cardScale, 1);
  snapAnimatedValue(values.vignetteOpacity, 0.25);
}

function startCardTimings(values: OverlayValues): () => void {
  const card = startTiming(values.cardOpacity, {
    toValue: 1,
    duration: motion.duration.slow,
    easing: Easing.bezier(0, 0, 0, 1),
    useNativeDriver: USE_NATIVE_DRIVER,
  });
  const scale = startTiming(values.cardScale, {
    toValue: 1,
    duration: motion.duration.slow,
    easing: Easing.bezier(0, 0, 0, 1),
    useNativeDriver: USE_NATIVE_DRIVER,
  });
  return () => {
    card.stop();
    scale.stop();
  };
}

function startVignette(values: OverlayValues): () => void {
  if (motion.duration.slower <= 0) {
    snapAnimatedValue(values.vignetteOpacity, 0.25);
    return () => undefined;
  }
  const loop = Animated.loop(
    Animated.sequence([
      Animated.timing(values.vignetteOpacity, {
        toValue: 0.35,
        duration: motion.duration.slower,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
      Animated.timing(values.vignetteOpacity, {
        toValue: 0.15,
        duration: motion.duration.slower,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
    ])
  );
  loop.start();
  return () => loop.stop();
}

function runCelebrationTimings(values: OverlayValues): () => void {
  const scrim = startTiming(values.scrimOpacity, {
    toValue: 1,
    duration: motion.duration.fast,
    useNativeDriver: USE_NATIVE_DRIVER,
  });
  const stopCard = startCardTimings(values);
  const stopVignette = startVignette(values);
  return () => {
    scrim.stop();
    stopCard();
    stopVignette();
  };
}

export function useCelebrationOverlayAnimation(
  completionKey: string
): OverlayValues {
  const scrimOpacity = useRef(new Animated.Value(0)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const cardScale = useRef(new Animated.Value(0.92)).current;
  const vignetteOpacity = useRef(new Animated.Value(0)).current;
  const values: OverlayValues = {
    scrimOpacity,
    cardOpacity,
    cardScale,
    vignetteOpacity,
  };

  useEffect(() => {
    scrimOpacity.setValue(0);
    cardOpacity.setValue(0);
    cardScale.setValue(0.92);
    vignetteOpacity.setValue(0);
    if (motion.duration.fast <= 0) {
      snapCelebration(values);
      return;
    }
    return runCelebrationTimings(values);
  }, [cardOpacity, cardScale, completionKey, scrimOpacity, vignetteOpacity]);

  return values;
}
