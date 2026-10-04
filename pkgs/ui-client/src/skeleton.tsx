/** @jsxImportSource solid-js */
import { cssPx } from '@pkgs/ui-shared/css-px';

/**
 * `Skeleton` -- static loading placeholder (no shimmer loop by design).
 *
 * @example
 * ```tsx
 * <Skeleton width={200} height={20} borderRadius={4} />
 * ```
 */

import type { ComponentDataSet } from '@pkgs/ui-shared/component-id';
import { dataAttrs } from '@pkgs/ui-shared/component-id';
import type { JSX } from 'solid-js';

export type SkeletonProps = {
  width?: number | `${number}%` | undefined;
  height?: number | undefined;
  borderRadius?: number | undefined;
  /** DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet | undefined;
};

export function Skeleton(props: SkeletonProps): JSX.Element {
  return (
    <div
      class="box overflow-hidden bg-surface-muted"
      {...dataAttrs({ component: 'Skeleton', ...props.dataSet })}
      style={{
        'border-radius': cssPx(props.borderRadius ?? 4),
        width: cssPx(props.width ?? '100%'),
        height: cssPx(props.height ?? 16),
      }}
      aria-hidden="true"
    />
  );
}
