/** @jsxImportSource solid-js */
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
import type { ComponentDataSet } from '../../component-id';
import type { ColorTokenName } from '../../theme';
import { Box } from '../box';

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
    <Box
      as="span"
      role={props.label === undefined ? undefined : 'img'}
      aria-label={props.label}
      aria-hidden={props.label === undefined ? true : undefined}
      dataSet={{ component: 'StatusDot', ...props.dataSet }}
      sx={{
        display: 'inline-flex',
        width: size(),
        height: size(),
        borderRadius: 'full',
        backgroundColor: STATUS_COLOR[props.status],
      }}
    />
  );
}
