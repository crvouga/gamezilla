import { USE_NATIVE_DRIVER } from '@pkgs/ui/animation/use-native-driver';
import { motion } from '@pkgs/ui/theme/motion';
import { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';

const CARD_DELAY_MS = 200;

export function useCelebrationOverlayAnimation(completionKey: string): {
  scrimOpacity: Animated.Value;
  cardOpacity: Animated.Value;
  cardScale: Animated.Value;
  vignetteOpacity: Animated.Value;
} {
  const scrimOpacity = useRef(new Animated.Value(0)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const cardScale = useRef(new Animated.Value(0.92)).current;
  const vignetteOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    scrimOpacity.setValue(0);
    cardOpacity.setValue(0);
    cardScale.setValue(0.92);
    vignetteOpacity.setValue(0);

    Animated.timing(scrimOpacity, {
      toValue: 1,
      duration: motion.duration.fast,
      useNativeDriver: USE_NATIVE_DRIVER,
    }).start();

    Animated.sequence([
      Animated.delay(CARD_DELAY_MS),
      Animated.parallel([
        Animated.timing(cardOpacity, {
          toValue: 1,
          duration: motion.duration.slow,
          easing: Easing.bezier(0, 0, 0, 1),
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.timing(cardScale, {
          toValue: 1,
          duration: motion.duration.slow,
          easing: Easing.bezier(0, 0, 0, 1),
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
      ]),
    ]).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(vignetteOpacity, {
          toValue: 0.35,
          duration: motion.duration.slower,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.timing(vignetteOpacity, {
          toValue: 0.15,
          duration: motion.duration.slower,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
      ])
    ).start();
  }, [cardOpacity, cardScale, completionKey, scrimOpacity, vignetteOpacity]);

  return { scrimOpacity, cardOpacity, cardScale, vignetteOpacity };
}
