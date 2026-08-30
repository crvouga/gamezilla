/**
 * `Skeleton` -- static loading placeholder.
 * Nuclear overhaul: no shimmer loop / LinearGradient (JS-thread death on web).
 *
 * @example
 * ```tsx
 * <Skeleton width={200} height={20} borderRadius={4} />
 * ```
 */

import type { ComponentDataSet } from '../../component-id';
import { Box } from '../box';

export type SkeletonProps = {
  width?: number | `${number}%`;
  height?: number;
  borderRadius?: number;
  /** Web DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet;
};

export function Skeleton({
  width = '100%',
  height = 16,
  borderRadius = 4,
  dataSet,
}: SkeletonProps) {
  return (
    <Box
      dataSet={{ component: 'Skeleton', ...dataSet }}
      sx={{
        width,
        height,
        borderRadius,
        overflow: 'hidden',
        backgroundColor: 'surfaceMuted',
      }}
    />
  );
}
