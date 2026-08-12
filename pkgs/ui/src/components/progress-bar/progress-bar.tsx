/**
 * `ProgressBar` -- determinate or indeterminate progress indicator.
 *
 * Track uses the active `outline` token; fill defaults to `tint`.
 * Determinate updates animate via {@link motion.duration.normal}; the
 * indeterminate variant sweeps continuously.
 *
 * @example
 * ```tsx
 * <ProgressBar progress={0.6} />
 * <ProgressBar indeterminate />
 * ```
 */

import { useEffect, useRef } from 'react';
import { Animated } from 'react-native';
import { USE_NATIVE_DRIVER } from '../../animation/use-native-driver';
import type { ComponentDataSet } from '../../component-id';
import { useTheme } from '../../theme';
import { duration } from '../../theme/motion';
import { AnimatedBox } from '../animated-box';
import { Box } from '../box';

export type ProgressBarProps = {
  /** Value between 0 and 1. Ignored when `indeterminate` is true. */
  progress?: number;
  /** Animate continuously. */
  indeterminate?: boolean;
  /** Color token or raw color. Defaults to `"tint"`. */
  color?: string;
  /** Track height in pixels. Defaults to 4. */
  height?: number;
  /** Web DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet;
};

const INDETERMINATE_DURATION = duration.slower * 2;

function clamp01(v: number): number {
  return Math.min(Math.max(v, 0), 1);
}

function useIndeterminateSweep(enabled: boolean): Animated.Value {
  const translateX = useRef(new Animated.Value(-1)).current;
  useEffect(() => {
    if (!enabled) return;
    const loop = Animated.loop(
      Animated.timing(translateX, {
        toValue: 1,
        duration: INDETERMINATE_DURATION,
        useNativeDriver: USE_NATIVE_DRIVER,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [enabled, translateX]);
  return translateX;
}

function useDeterminateProgress(value: number): Animated.Value {
  const animated = useRef(new Animated.Value(value)).current;
  useEffect(() => {
    Animated.timing(animated, {
      toValue: value,
      duration: duration.normal,
      useNativeDriver: false,
    }).start();
  }, [animated, value]);
  return animated;
}

export function ProgressBar({
  progress = 0,
  indeterminate = false,
  color = 'tint',
  height = 4,
  dataSet,
}: ProgressBarProps) {
  const theme = useTheme();
  const fillColor = theme.colors[color as keyof typeof theme.colors] ?? color;
  const translateX = useIndeterminateSweep(indeterminate);
  const animatedProgress = useDeterminateProgress(clamp01(progress));

  const widthInterpolation = animatedProgress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <Box
      dataSet={{ component: 'ProgressBar', ...dataSet }}
      sx={{
        height,
        borderRadius: height / 2,
        backgroundColor: 'outline',
        overflow: 'hidden',
      }}
    >
      {indeterminate ? (
        <AnimatedBox
          sx={{
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
        <AnimatedBox
          sx={{
            height,
            width: widthInterpolation,
            borderRadius: height / 2,
            backgroundColor: fillColor,
          }}
        />
      )}
    </Box>
  );
}
