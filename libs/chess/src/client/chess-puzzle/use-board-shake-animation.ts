import { USE_NATIVE_DRIVER } from '@pkgs/ui/animation/use-native-driver';
import { useEffect, useRef } from 'react';
import { Animated } from 'react-native';

const SHAKE_OFFSET = 4;
const SHAKE_STEP_MS = 50;

export function useBoardShakeAnimation(shakeNonce: number): Animated.Value {
  const shakeX = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (shakeNonce === 0) return;
    shakeX.setValue(0);
    Animated.sequence([
      Animated.timing(shakeX, {
        toValue: SHAKE_OFFSET,
        duration: SHAKE_STEP_MS,
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
      Animated.timing(shakeX, {
        toValue: -SHAKE_OFFSET,
        duration: SHAKE_STEP_MS,
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
      Animated.timing(shakeX, {
        toValue: SHAKE_OFFSET,
        duration: SHAKE_STEP_MS,
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
      Animated.timing(shakeX, {
        toValue: 0,
        duration: SHAKE_STEP_MS,
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
    ]).start();
  }, [shakeNonce, shakeX]);

  return shakeX;
}
