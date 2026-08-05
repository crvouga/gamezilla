/**
 * `GradientBox` — themed linear gradient surface using `expo-linear-gradient`.
 *
 * Use `sx` for layout (padding, radius, flex). Gradient stops default to
 * two close shades of the active brand `tint` (`tintHover` -> `tintActive`)
 * so callers get a subtle brand-colored gradient out of the box. Override
 * `colors` to render any other gradient (success, destructive, neutral,
 * custom hex pairs, etc).
 *
 * Children are wrapped in an {@link OnColorProvider} that always uses the
 * theme's `onPrimary` foreground (white in both schemes). Luminance heuristics
 * mis-fire on lighter dark-mode blues and pick near-black labels; brand
 * gradient chrome is always light-on-blue. Pass `onColor` to derive from a
 * different reference (custom gradients).
 */

import { LinearGradient } from 'expo-linear-gradient';
import type { ColorValue, ViewProps } from 'react-native';
import { useMemo } from 'react';
import { componentDataSet, type ComponentDataSet } from '../../component-id';
import {
  bestOnColor,
  ON_DARK,
  OnColorProvider,
  useTheme,
  type OnColorSet,
  type SxProps,
} from '../../theme';

export type GradientBoxProps = ViewProps & {
  /** Utility-first style shorthand (padding, radius, flex — not solid fills). */
  sx?: SxProps;
  /**
   * At least two colors. Defaults to the theme primary gradient.
   * Pass inline or `as const` so TypeScript accepts the tuple.
   */
  colors?: readonly [ColorValue, ColorValue, ...ColorValue[]];
  /** Normalized 0–1; default horizontal left → right. */
  start?: { x: number; y: number } | null;
  end?: { x: number; y: number } | null;
  /**
   * When set, derive child text/icon colors via {@link bestOnColor} from this
   * reference instead of the default `onPrimary` set.
   */
  onColor?: string;
  /** Web DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet;
};

function defaultGradientOnColor(onPrimary: string): OnColorSet {
  return {
    fg: onPrimary,
    fgMuted: ON_DARK.fgMuted,
    icon: onPrimary,
  };
}

export function GradientBox({
  sx: sxProp,
  style,
  colors: colorsProp,
  start = { x: 0, y: 0.5 },
  end = { x: 1, y: 0.5 },
  onColor,
  children,
  dataSet,
  ...rest
}: GradientBoxProps) {
  const theme = useTheme();
  const sxStyle = sxProp ? theme.sx(sxProp) : undefined;
  const colors: readonly [ColorValue, ColorValue, ...ColorValue[]] =
    colorsProp ?? [theme.colors.tintHover, theme.colors.tintActive];
  const onColorValue = useMemo(
    (): OnColorSet =>
      onColor !== undefined
        ? bestOnColor(onColor)
        : defaultGradientOnColor(theme.colors.onPrimary),
    [onColor, theme.colors.onPrimary]
  );
  const idProps = componentDataSet('GradientBox', dataSet);

  return (
    <LinearGradient
      colors={colors}
      start={start}
      end={end}
      style={[sxStyle, style]}
      {...rest}
      {...idProps}
    >
      <OnColorProvider value={onColorValue}>{children}</OnColorProvider>
    </LinearGradient>
  );
}
