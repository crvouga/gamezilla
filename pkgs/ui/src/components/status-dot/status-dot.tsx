/**
 * `StatusDot` -- small colored circle indicating a status.
 *
 * @example
 * ```tsx
 * <StatusDot status="online" />
 * <StatusDot status="offline" size={12} />
 * ```
 */

import { View } from 'react-native';
import { componentDataSet, type ComponentDataSet } from '../../component-id';
import { useTheme } from '../../theme';

export type StatusDotStatus = 'online' | 'offline' | 'warning';

export type StatusDotProps = {
  status: StatusDotStatus;
  /** Diameter in pixels. Defaults to 10. */
  size?: number;
  /** Web DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet;
};

export function StatusDot({ status, size = 10, dataSet }: StatusDotProps) {
  const theme = useTheme();

  const colorMap: Record<StatusDotStatus, string> = {
    online: theme.colors.success,
    offline: theme.colors.destructive,
    warning: theme.colors.warning,
  };

  return (
    <View
      {...componentDataSet('StatusDot', dataSet)}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: colorMap[status],
      }}
    />
  );
}
