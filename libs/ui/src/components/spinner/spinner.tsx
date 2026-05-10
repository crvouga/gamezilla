/**
 * `Spinner` -- themed loading indicator that renders identically on iOS,
 * Android, and the web.
 *
 * Internally we draw a partial SVG arc (via `react-native-svg`) and rotate
 * it with the built-in `Animated` API. This avoids `ActivityIndicator`,
 * whose visual style varies per platform.
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

import { useTheme } from '../../theme';

export type SpinnerSize = 'small' | 'large' | number;

export type SpinnerProps = {
  /** Color token name or raw color. Defaults to `"tint"`. */
  color?: string;
  /** Diameter in pixels, or one of the size presets. Defaults to `"small"`. */
  size?: SpinnerSize;
  /** Stroke width in pixels. Derived from `size` if omitted. */
  strokeWidth?: number;
};

const SIZE_PRESETS = {
  small: 18,
  large: 36,
} as const satisfies Record<'small' | 'large', number>;

const SPIN_DURATION_MS = 900;
/** Visible arc covers 25% of the circle perimeter. */
const ARC_FRACTION = 0.25;
/** Faded base ring rendered behind the moving arc. */
const TRACK_OPACITY = 0.25;

function resolveSize(size: SpinnerSize): number {
  return typeof size === 'number' ? size : SIZE_PRESETS[size];
}

export function Spinner({
  color = 'tint',
  size = 'small',
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

  const rotation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    rotation.setValue(0);
    const loop = Animated.loop(
      Animated.timing(rotation, {
        toValue: 1,
        duration: SPIN_DURATION_MS,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [rotation]);

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
