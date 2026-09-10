/** @jsxImportSource solid-js */
import { cssPx } from '../../css/css-px';
/**
 * `StatusDot` -- small colored circle indicating a status.
 *
 * @example
 * ```tsx
 * <StatusDot status="online" />
 * <StatusDot status="offline" size={12} />
 * ```
 */

import type { JSX } from 'solid-js';
import { type ComponentDataSet, dataAttrs } from '../../component-id';
import { type ColorTokenName, colorVar } from '../../theme';

export type StatusDotStatus = 'online' | 'offline' | 'warning' | 'pending';

export type StatusDotProps = {
  status: StatusDotStatus;
  /** Diameter in pixels. Defaults to 10. */
  size?: number | undefined;
  /** Accessible name; omitted dots are decorative (`aria-hidden`). */
  label?: string | undefined;
  /** DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet | undefined;
};

const STATUS_COLOR: Record<StatusDotStatus, ColorTokenName> = {
  online: 'success',
  offline: 'destructive',
  warning: 'warning',
  pending: 'info',
};

const DEFAULT_SIZE = 10;

export function StatusDot(props: StatusDotProps): JSX.Element {
  const size = () => props.size ?? DEFAULT_SIZE;
  return (
    <span
      class="box inline-flex rounded-[9999px]"
      {...dataAttrs({ component: 'StatusDot', ...props.dataSet })}
      style={{
        'background-color': colorVar(STATUS_COLOR[props.status]),
        width: cssPx(size()),
        height: cssPx(size()),
      }}
      role={props.label === undefined ? undefined : 'img'}
      aria-label={props.label}
      aria-hidden={props.label === undefined ? true : undefined}
    />
  );
}
