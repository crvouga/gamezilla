/**
 * `ProgressBar` -- determinate or indeterminate progress indicator.
 *
 * @example
 * ```tsx
 * <ProgressBar progress={0.6} />
 * <ProgressBar indeterminate />
 * ```
 */

import { useEffect, useRef } from 'react';
import { Animated, View } from 'react-native';
import { USE_NATIVE_DRIVER } from '../../animation/use-native-driver';
import { useTheme } from '../../theme';

export type ProgressBarProps = {
  /** Value between 0 and 1. Ignored when `indeterminate` is true. */
  progress?: number;
  /** Animate continuously. */
  indeterminate?: boolean;
  /** Color token or raw color. Defaults to `"tint"`. */
  color?: string;
  /** Track height in pixels. Defaults to 4. */
  height?: number;
};

export function ProgressBar({
  progress = 0,
  indeterminate = false,
  color = 'tint',
  height = 4,
}: ProgressBarProps) {
  const theme = useTheme();
  const fillColor = theme.colors[color as keyof typeof theme.colors] ?? color;
  const translateX = useRef(new Animated.Value(-1)).current;

  useEffect(() => {
    if (!indeterminate) return;
    const loop = Animated.loop(
      Animated.timing(translateX, {
        toValue: 1,
        duration: 1200,
        useNativeDriver: USE_NATIVE_DRIVER,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [indeterminate, translateX]);

  return (
    <View
      style={{
        height,
        borderRadius: height / 2,
        backgroundColor: theme.colors.border,
        overflow: 'hidden',
      }}
    >
      {indeterminate ? (
        <Animated.View
          style={{
            height,
            width: '30%',
            borderRadius: height / 2,
            backgroundColor: fillColor,
            transform: [
              {
                translateX: translateX.interpolate({
                  inputRange: [-1, 1],
                  outputRange: [-100, 400],
                }),
              },
            ],
          }}
        />
      ) : (
        <View
          style={{
            height,
            width: `${Math.min(Math.max(progress, 0), 1) * 100}%`,
            borderRadius: height / 2,
            backgroundColor: fillColor,
          }}
        />
      )}
    </View>
  );
}
