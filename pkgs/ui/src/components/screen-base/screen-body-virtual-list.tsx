/** @jsxImportSource solid-js */
/**
 * Full-bleed `VirtualList` for nested lists inside a non-scrolling
 * `ScreenBase` body (replaces the RN `ScreenBodyFlatList` /
 * `ScreenBodyLegendList` pair).
 *
 * Relies on `ContentEdgePaddingProvider` from the body shell so the
 * scrollbar sits flush with the screen edge.
 */

import { type JSX, splitProps } from 'solid-js';
import { Box } from '../box';
import { VirtualList, type VirtualListProps } from '../virtual-list';

export type ScreenBodyVirtualListProps<ItemT> = VirtualListProps<ItemT>;

export function ScreenBodyVirtualList<ItemT>(
  props: ScreenBodyVirtualListProps<ItemT>
): JSX.Element {
  const [local, rest] = splitProps(props, ['frameSx', 'dataSet']);
  return (
    <Box sx={{ flex: 1, minHeight: 0 }}>
      <VirtualList
        frameSx={[{ flex: 1 }, local.frameSx]}
        dataSet={{ component: 'ScreenBodyVirtualList', ...local.dataSet }}
        {...rest}
      />
    </Box>
  );
}
