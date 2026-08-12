/**
 * `StatusDot` -- small colored circle indicating a status.
 *
 * @example
 * ```tsx
 * <StatusDot status="online" />
 * <StatusDot status="offline" size={12} />
 * ```
 */

import type { ComponentDataSet } from '../../component-id';
import { Box } from '../box';

export type StatusDotStatus = 'online' | 'offline' | 'warning';

export type StatusDotProps = {
  status: StatusDotStatus;
  /** Diameter in pixels. Defaults to 10. */
  size?: number;
  /** Web DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet;
};

const STATUS_COLOR = {
  online: 'success',
  offline: 'destructive',
  warning: 'warning',
} as const;

export function StatusDot({ status, size = 10, dataSet }: StatusDotProps) {
  return (
    <Box
      dataSet={{ component: 'StatusDot', ...dataSet }}
      sx={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: STATUS_COLOR[status],
      }}
    />
  );
}
