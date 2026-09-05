/**
 * Full-bleed {@link LegendList} for nested lists inside a non-scrolling
 * {@link ScreenBase} body.
 */

import type { ReactElement, Ref } from 'react';
import type { RefreshControlProps } from 'react-native';

import { useLayoutMode } from '../../theme/use-layout-mode';
import { Box } from '../box';
import { LegendList, type LegendListProps } from '../legend-list';
import { useResolvedRefreshControl } from '../pull-to-refresh';

export type ScreenBodyLegendListColumns = {
  compact: number;
  wide: number;
};

export type ScreenBodyLegendListProps<ItemT = unknown> = Omit<
  LegendListProps<ItemT>,
  'onRefresh' | 'refreshing' | 'refreshControl' | 'ref' | 'numColumns'
> & {
  onRefresh?: (() => void | Promise<void>) | undefined;
  refreshing?: boolean | undefined;
  refreshControl?: ReactElement<RefreshControlProps> | undefined;
  /**
   * Declarative column counts per layout mode. Resolved via
   * {@link useLayoutMode} into LegendList `numColumns`.
   */
  columns?: ScreenBodyLegendListColumns;
  // Opaque list ref — callers rarely need it; typed loosely for EOTP.
  ref?: Ref<unknown>;
};

export function ScreenBodyLegendList<ItemT>(
  props: ScreenBodyLegendListProps<ItemT>
): ReactElement {
  const {
    frameSx,
    onRefresh,
    refreshing,
    refreshControl,
    columns,
    ref,
    ...rest
  } = props;
  const mode = useLayoutMode();
  const numColumns =
    columns !== undefined
      ? mode === 'wide'
        ? columns.wide
        : columns.compact
      : undefined;
  const resolved = useResolvedRefreshControl({
    onRefresh,
    refreshing,
    refreshControl,
  });
  return (
    <Box sx={{ flex: 1, minHeight: 0 }}>
      <LegendList
        {...rest}
        {...(ref != null ? { ref: ref as never } : {})}
        {...(numColumns !== undefined ? { numColumns } : {})}
        frameSx={[{ flex: 1 }, frameSx]}
        {...(resolved !== undefined ? { refreshControl: resolved } : {})}
      />
    </Box>
  );
}
