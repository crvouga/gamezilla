/**
 * `Spinner` -- themed loading indicator that renders identically on iOS,
 * Android, and the web.
 *
 * Internally we draw a partial SVG arc (via `react-native-svg`) and rotate
 * it with the built-in `Animated` API. This avoids `ActivityIndicator`,
 * whose visual style varies per platform.
 *
 * When mounted under a `SpinnerProvider` the rotation `Animated.Value` is
 * shared across all spinner instances with the same `size`/`color`/
 * `strokeWidth`, so swapping between sibling loading states does not visibly
 * restart the animation back to 0°. Without a provider each instance runs
 * its own local loop (the original behavior).
 *
 * @example
 * ```tsx
 * <Spinner size="small" />
 * <Spinner size={32} color="destructive" />
 * ```
 */

import { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { USE_NATIVE_DRIVER } from '../../animation/use-native-driver';
import { useTheme } from '../../theme';
import { SPIN_DURATION_MS, useSharedSpinnerRotation } from './spinner-context';

export type SpinnerSize = 'small' | 'medium' | 'large' | number;

export type SpinnerProps = {
  /** Color token name or raw color. Defaults to `"tint"`. */
  color?: string;
  /** Diameter in pixels, or one of the size presets. Defaults to `"small"`. */
  size?: SpinnerSize;
  /** Stroke width in pixels. Derived from `size` if omitted. */
  strokeWidth?: number;
};

const SIZE_PRESETS = {
  small: 24,
  medium: 36,
  large: 48,
} as const satisfies Record<'small' | 'medium' | 'large', number>;

/** Visible arc covers 25% of the circle perimeter. */
const ARC_FRACTION = 0.25;
/** Faded base ring rendered behind the moving arc. */
const TRACK_OPACITY = 0.25;

function resolveSize(size: SpinnerSize): number {
  return typeof size === 'number' ? size : SIZE_PRESETS[size];
}

function rotationKey(
  size: SpinnerSize,
  color: string,
  strokeWidth: number | undefined
): string {
  return `${String(size)}|${color}|${strokeWidth ?? 'auto'}`;
}

function useSpinnerRotation(
  size: SpinnerSize,
  color: string,
  strokeWidth: number | undefined
): Animated.Value {
  const shared = useSharedSpinnerRotation(
    rotationKey(size, color, strokeWidth)
  );
  const localRef = useRef<Animated.Value | null>(null);
  if (localRef.current === null) localRef.current = new Animated.Value(0);
  const local = localRef.current;

  useEffect(() => {
    if (shared !== null) return undefined;
    local.setValue(0);
    const loop = Animated.loop(
      Animated.timing(local, {
        toValue: 1,
        duration: SPIN_DURATION_MS,
        easing: Easing.linear,
        useNativeDriver: USE_NATIVE_DRIVER,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [shared, local]);

  return shared ?? local;
}

export function Spinner({
  color = 'tint',
  size = 'medium',
  strokeWidth,
}: SpinnerProps) {
  const theme = useTheme();
  const stroke = theme.colors[color as keyof typeof theme.colors] ?? color;
  const diameter = resolveSize(size);
  const sw = strokeWidth ?? Math.max(2, Math.round(diameter * 0.12));
  const radius = (diameter - sw) / 2;
  const circumference = 2 * Math.PI * radius;
  const dash = circumference * ARC_FRACTION;
  const gap = circumference - dash;

  const rotation = useSpinnerRotation(size, color, strokeWidth);

  const spin = rotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <Animated.View
      accessibilityRole="progressbar"
      style={{
        width: diameter,
        height: diameter,
        transform: [{ rotate: spin }],
      }}
    >
      <Svg
        width={diameter}
        height={diameter}
        viewBox={`0 0 ${diameter} ${diameter}`}
      >
        <Circle
          cx={diameter / 2}
          cy={diameter / 2}
          r={radius}
          stroke={stroke}
          strokeWidth={sw}
          fill="none"
          opacity={TRACK_OPACITY}
        />
        <Circle
          cx={diameter / 2}
          cy={diameter / 2}
          r={radius}
          stroke={stroke}
          strokeWidth={sw}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${gap}`}
          fill="none"
        />
      </Svg>
    </Animated.View>
  );
}
