/** @jsxImportSource solid-js */
/**
 * `Skeleton` -- loading placeholder in the shape of the content it stands
 * for: a `surface-muted` block with a subtle 1.2s opacity pulse (`.skeleton`
 * in `hosts.css`) that stops under reduced motion. The radius comes from
 * `shape`, never a length: `text` lines (`rounded-sm`), `rect` media and
 * cards (`rounded-control`), `circle` avatars (`rounded-full`).
 *
 * @example
 * ```tsx
 * <Skeleton width={200} height={20} />
 * <Skeleton width={48} height={48} shape="circle" />
 * ```
 */

import type { ComponentDataSet } from '@pkgs/ui-root-shared/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared/component-id';
import { cssPx } from '@pkgs/ui-root-shared/css-px';
import type { JSX } from 'solid-js';

export type SkeletonShape = 'text' | 'rect' | 'circle';

export type SkeletonProps = {
  width?: number | `${number}%` | undefined;
  height?: number | undefined;
  /** Corner treatment. Defaults to `text`. */
  shape?: SkeletonShape | undefined;
  /** DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet | undefined;
};

const SHAPE_CLASS: Record<SkeletonShape, string> = {
  text: 'rounded-sm',
  rect: 'rounded-control',
  circle: 'rounded-full',
};

export function Skeleton(props: SkeletonProps): JSX.Element {
  return (
    <div
      class="box skeleton shrink-0 overflow-hidden bg-surface-muted"
      classList={{ [SHAPE_CLASS[props.shape ?? 'text']]: true }}
      {...dataAttrs({
        component: 'Skeleton',
        shape: props.shape ?? 'text',
        ...props.dataSet,
      })}
      style={{
        width: cssPx(props.width ?? '100%'),
        height: cssPx(props.height ?? 16),
      }}
      aria-hidden="true"
    />
  );
}
