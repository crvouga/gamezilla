import { USE_NATIVE_DRIVER } from '@pkgs/ui/animation/use-native-driver';
import { useEffect, useRef } from 'react';
import { Animated } from 'react-native';

const SLIDE_MS = 280;

export function useSummaryOverlayAnimation(
  completionKey: string
): { fade: Animated.Value; slide: Animated.Value } {
  const slide = useRef(new Animated.Value(24)).current;
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    slide.setValue(24);
    fade.setValue(0);
    Animated.parallel([
      Animated.timing(slide, {
        toValue: 0,
        duration: SLIDE_MS,
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
      Animated.timing(fade, {
        toValue: 1,
        duration: SLIDE_MS,
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
    ]).start();
  }, [completionKey, fade, slide]);

  return { fade, slide };
}
