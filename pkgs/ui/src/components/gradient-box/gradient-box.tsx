/**
 * `GradientBox` — themed linear gradient surface using `expo-linear-gradient`.
 *
 * Use `sx` for layout (padding, radius, flex). Gradient stops default to
 * two close shades of the active brand `tint` (`tintHover` -> `tintActive`)
 * so callers get a subtle brand-colored gradient out of the box. Override
 * `colors` to render any other gradient (success, destructive, neutral,
 * custom hex pairs, etc).
 */

import { LinearGradient } from 'expo-linear-gradient';
import type { ColorValue, ViewProps } from 'react-native';
import { useTheme, type SxProps } from '../../theme';

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
};

export function GradientBox({
  sx: sxProp,
  style,
  colors: colorsProp,
  start = { x: 0, y: 0.5 },
  end = { x: 1, y: 0.5 },
  ...rest
}: GradientBoxProps) {
  const theme = useTheme();
  const sxStyle = sxProp ? theme.sx(sxProp) : undefined;
  const colors: readonly [ColorValue, ColorValue, ...ColorValue[]] =
    colorsProp ?? [theme.colors.tintActive, theme.colors.tintActive];

  return (
    <LinearGradient
      colors={colors}
      start={start}
      end={end}
      style={[sxStyle, style]}
      {...rest}
    />
  );
}
