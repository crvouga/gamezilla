/** @jsxImportSource solid-js */
/**
 * `ProgressBar` -- determinate or indeterminate progress indicator.
 *
 * Exposes `role="progressbar"` with `aria-valuenow` (omitted while
 * indeterminate, per WAI-ARIA). The fill width animates with a CSS
 * transition; indeterminate shows a static partial fill.
 *
 * @example
 * ```tsx
 * <ProgressBar progress={0.6} />
 * <ProgressBar indeterminate />
 * ```
 */

import type { JSX } from 'solid-js';
import type { ComponentDataSet } from '../../component-id';
import { resolveColor, useThemeTokens } from '../../theme';
import { Box } from '../box';

export type ProgressBarProps = {
  /** Value between 0 and 1. Ignored when `indeterminate` is true. */
  progress?: number | undefined;
  /** Shows a partial fill (static) instead of a value. */
  indeterminate?: boolean | undefined;
  /** Color token or raw color. Defaults to `"tint"`. */
  color?: string | undefined;
  /** Track height in pixels. Defaults to 4. */
  height?: number | undefined;
  /** Accessible name for the bar. */
  label?: string | undefined;
  /** DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet | undefined;
};

export function clamp01(v: number): number {
  return Math.min(Math.max(v, 0), 1);
}

const INDETERMINATE_FILL = '40%';

export function ProgressBar(props: ProgressBarProps): JSX.Element {
  const tokens = useThemeTokens();
  const height = (): number => props.height ?? 4;
  const indeterminate = (): boolean => props.indeterminate === true;
  const value = (): number => clamp01(props.progress ?? 0);
  const fillColor = (): string =>
    resolveColor(props.color ?? 'tint', tokens.colors) ?? tokens.colors.tint;
  const widthPct = (): string =>
    indeterminate() ? INDETERMINATE_FILL : `${value() * 100}%`;
  return (
    <Box
      role="progressbar"
      aria-label={props.label}
      aria-valuemin={0}
      aria-valuemax={1}
      aria-valuenow={indeterminate() ? undefined : value()}
      aria-busy={indeterminate() ? true : undefined}
      dataSet={{ component: 'ProgressBar', ...props.dataSet }}
      sx={{
        height: height(),
        borderRadius: height() / 2,
        backgroundColor: 'outline',
        overflow: 'hidden',
      }}
    >
      <Box
        sx={{
          height: height(),
          width: widthPct(),
          borderRadius: height() / 2,
          backgroundColor: fillColor(),
          transitionProperty: 'width',
          transitionDuration: 'var(--ui-duration-normal)',
          transitionTimingFunction: 'var(--ui-easing-standard)',
        }}
      />
    </Box>
  );
}
