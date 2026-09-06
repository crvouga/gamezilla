/**
 * `ProgressBar` -- determinate or indeterminate progress indicator.
 * Nuclear overhaul: no Animated loops / width timing — instant fill.
 *
 * @example
 * ```tsx
 * <ProgressBar progress={0.6} />
 * <ProgressBar indeterminate />
 * ```
 */

import type { ComponentDataSet } from '../../component-id';
import { useTheme } from '../../theme';
import { Box } from '../box';

export type ProgressBarProps = {
  /** Value between 0 and 1. Ignored when `indeterminate` is true. */
  progress?: number;
  /** Shows a partial fill (static) instead of a sweep. */
  indeterminate?: boolean;
  /** Color token or raw color. Defaults to `"tint"`. */
  color?: string;
  /** Track height in pixels. Defaults to 4. */
  height?: number;
  /** Web DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet;
};

function clamp01(v: number): number {
  return Math.min(Math.max(v, 0), 1);
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
  const widthPct = indeterminate ? '40%' : `${clamp01(progress) * 100}%`;

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
      <Box
        sx={{
          height,
          width: widthPct,
          borderRadius: height / 2,
          backgroundColor: fillColor,
        }}
      />
    </Box>
  );
}
