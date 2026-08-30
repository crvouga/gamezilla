/**
 * Full-bleed {@link LegendList} for nested lists inside a non-scrolling
 * {@link ScreenBase} body.
 */

import type { ReactElement, Ref } from 'react';
import type { RefreshControlProps } from 'react-native';

import { Box } from '../box';
import { LegendList, type LegendListProps } from '../legend-list';
import { useResolvedRefreshControl } from '../pull-to-refresh';

export type ScreenBodyLegendListProps<ItemT = unknown> = Omit<
  LegendListProps<ItemT>,
  'onRefresh' | 'refreshing' | 'refreshControl' | 'ref'
> & {
  onRefresh?: (() => void | Promise<void>) | undefined;
  refreshing?: boolean | undefined;
  refreshControl?: ReactElement<RefreshControlProps> | undefined;
  // Opaque list ref — callers rarely need it; typed loosely for EOTP.
  ref?: Ref<unknown>;
};

export function ScreenBodyLegendList<ItemT>(
  props: ScreenBodyLegendListProps<ItemT>
): ReactElement {
  const { frameSx, onRefresh, refreshing, refreshControl, ref, ...rest } =
    props;
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
        frameSx={[{ flex: 1 }, frameSx]}
        {...(resolved !== undefined ? { refreshControl: resolved } : {})}
      />
    </Box>
  );
}
