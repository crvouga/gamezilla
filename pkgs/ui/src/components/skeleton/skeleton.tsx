/**
 * `Skeleton` -- animated loading placeholder with a gradient shimmer sweep.
 *
 * Renders a `surfaceMuted` block with a translucent `surfaceElevated`
 * gradient sweeping across it on a slow loop. Falls back to a static block
 * on web when the user prefers reduced motion.
 *
 * @example
 * ```tsx
 * <Skeleton width={200} height={20} borderRadius={4} />
 * ```
 */

import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';
import { Animated, Platform, View, type LayoutChangeEvent } from 'react-native';
import { USE_NATIVE_DRIVER } from '../../animation/use-native-driver';
import { componentDataSet, type ComponentDataSet } from '../../component-id';
import { useTheme } from '../../theme';
import { duration } from '../../theme/motion';

export type SkeletonProps = {
  width?: number | `${number}%`;
  height?: number;
  borderRadius?: number;
  /** Web DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet;
};

const SHIMMER_DURATION = duration.slower * 3;
const SHIMMER_WIDTH_RATIO = 0.6;

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState<boolean>(false);
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return reduced;
}

function useShimmerLoop(enabled: boolean): Animated.Value {
  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!enabled) {
      progress.setValue(0);
      return undefined;
    }
    const loop = Animated.loop(
      Animated.timing(progress, {
        toValue: 1,
        duration: SHIMMER_DURATION,
        useNativeDriver: USE_NATIVE_DRIVER,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [enabled, progress]);
  return progress;
}

export function Skeleton({
  width = '100%',
  height = 16,
  borderRadius = 4,
  dataSet,
}: SkeletonProps) {
  const theme = useTheme();
  const reducedMotion = usePrefersReducedMotion();
  const [measuredWidth, setMeasuredWidth] = useState<number>(0);
  const progress = useShimmerLoop(!reducedMotion);

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w !== measuredWidth) setMeasuredWidth(w);
  };

  const sweepWidth = Math.max(measuredWidth * SHIMMER_WIDTH_RATIO, 60);
  const translateX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [-sweepWidth, measuredWidth + sweepWidth],
  });

  return (
    <View
      {...componentDataSet('Skeleton', dataSet)}
      onLayout={onLayout}
      style={{
        width,
        height,
        borderRadius,
        overflow: 'hidden',
        backgroundColor: theme.colors.surfaceMuted,
      }}
    >
      {reducedMotion || measuredWidth === 0 ? null : (
        <Animated.View
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            width: sweepWidth,
            transform: [{ translateX }],
          }}
        >
          <LinearGradient
            colors={[
              'rgba(255,255,255,0)',
              theme.colors.surfaceElevated,
              'rgba(255,255,255,0)',
            ]}
            locations={[0, 0.5, 1]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={{ flex: 1, opacity: 0.6 }}
          />
        </Animated.View>
      )}
    </View>
  );
}
