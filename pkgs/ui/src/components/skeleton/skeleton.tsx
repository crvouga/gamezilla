/** @jsxImportSource solid-js */
/**
 * `Skeleton` -- static loading placeholder (no shimmer loop by design).
 *
 * @example
 * ```tsx
 * <Skeleton width={200} height={20} borderRadius={4} />
 * ```
 */

import type { JSX } from 'solid-js';
import type { ComponentDataSet } from '../../component-id';
import { Box } from '../box';

export type SkeletonProps = {
  width?: number | `${number}%` | undefined;
  height?: number | undefined;
  borderRadius?: number | undefined;
  /** DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet | undefined;
};

export function Skeleton(props: SkeletonProps): JSX.Element {
  return (
    <Box
      aria-hidden="true"
      dataSet={{ component: 'Skeleton', ...props.dataSet }}
      sx={{
        width: props.width ?? '100%',
        height: props.height ?? 16,
        borderRadius: props.borderRadius ?? 4,
        overflow: 'hidden',
        backgroundColor: 'surfaceMuted',
      }}
    />
  );
}
