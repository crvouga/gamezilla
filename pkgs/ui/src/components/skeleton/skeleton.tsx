/**
 * `Skeleton` -- animated loading placeholder.
 *
 * Uses the built-in RN `Animated` API for a pulsing opacity effect.
 *
 * @example
 * ```tsx
 * <Skeleton width={200} height={20} borderRadius={4} />
 * ```
 */

import { useEffect, useRef } from 'react';
import { Animated } from 'react-native';
import { USE_NATIVE_DRIVER } from '../../animation/use-native-driver';
import { useTheme } from '../../theme';

export type SkeletonProps = {
  width?: number | `${number}%`;
  height?: number;
  borderRadius?: number;
};

export function Skeleton({
  width = '100%',
  height = 16,
  borderRadius = 4,
}: SkeletonProps) {
  const theme = useTheme();
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 800,
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={{
        width,
        height,
        borderRadius,
        backgroundColor: theme.colors.border,
        opacity,
      }}
    />
  );
}
