/**
 * `GradientBox` — themed linear gradient surface using `expo-linear-gradient`.
 *
 * Use `sx` for layout (padding, radius, flex). Gradient stops default to
 * two close shades of the active brand `tint`. Children are wrapped in an
 * {@link OnColorProvider} that uses `onPrimary` unless `onColor` is set.
 */

import { LinearGradient } from 'expo-linear-gradient';
import { useMemo } from 'react';
import type { ViewProps } from 'react-native';
import {
  COMPONENT_IDS_ENABLED,
  type ComponentDataSet,
} from '../../component-id';
import {
  bestOnColor,
  ON_DARK,
  OnColorProvider,
  type OnColorSet,
  type SxInput,
  useHostSx,
  useTheme,
} from '../../theme';
import { linearGradientCss, mergeCss } from './gradient-css';

export type GradientBoxProps = Omit<ViewProps, 'style'> & {
  /** Utility-first style shorthand (padding, radius, flex — not solid fills). */
  sx?: SxInput;
  /**
   * At least two colors. Defaults to the theme primary gradient.
   */
  colors?: readonly [string, string, ...string[]];
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
  colors: colorsProp,
  start = { x: 0, y: 0.5 },
  end = { x: 1, y: 0.5 },
  onColor,
  children,
  dataSet,
  ...rest
}: GradientBoxProps) {
  const theme = useTheme();
  const colors: readonly [string, string, ...string[]] = colorsProp ?? [
    theme.colors.tintHover,
    theme.colors.tintActive,
  ];
  const origin = start ?? { x: 0, y: 0.5 };
  const dest = end ?? { x: 1, y: 0.5 };
  const host = useHostSx('GradientBox', sxProp, dataSet);
  const onColorValue = useMemo(
    (): OnColorSet =>
      onColor !== undefined
        ? bestOnColor(onColor)
        : defaultGradientOnColor(theme.colors.onPrimary),
    [onColor, theme.colors.onPrimary]
  );
  const captured = host.dataSet.dataSet;
  const css = COMPONENT_IDS_ENABLED
    ? mergeCss(captured?.['css'], linearGradientCss(colors, origin, dest))
    : undefined;
  const idProps =
    captured === undefined && css === undefined
      ? {}
      : { dataSet: { ...captured, ...(css !== undefined ? { css } : {}) } };

  return (
    <LinearGradient
      colors={colors}
      start={origin}
      end={dest}
      style={host.style}
      {...rest}
      {...idProps}
    >
      <OnColorProvider value={onColorValue}>{children}</OnColorProvider>
    </LinearGradient>
  );
}
