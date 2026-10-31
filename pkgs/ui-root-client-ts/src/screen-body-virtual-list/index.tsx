/** @jsxImportSource solid-js */

import type { JSX } from 'solid-js';
import type { VirtualListProps } from '../virtual-list/index';
import { VirtualList } from '../virtual-list/index';

export type ScreenBodyVirtualListProps<ItemT> = Omit<
  VirtualListProps<ItemT>,
  'grow'
>;

/**
 * Full-bleed `VirtualList` for nested lists inside a non-scrolling
 * `ScreenBase` body (replaces the RN `ScreenBodyFlatList` /
 * `ScreenBodyLegendList` pair).
 *
 * Relies on `ContentEdgePaddingProvider` from the body shell so the
 * scrollbar sits flush with the screen edge. It always grows into the body's
 * leftover height.
 */
export function ScreenBodyVirtualList<ItemT>(
  props: ScreenBodyVirtualListProps<ItemT>
): JSX.Element {
  return (
    // `.box` so a flush-edge VirtualList wrapper is a flex child and inherits
    // a definite height (otherwise the scrollport collapses on the wide canvas).
    <div class="box flex-1 min-h-0">
      <VirtualList
        {...props}
        grow
        dataSet={{ component: 'ScreenBodyVirtualList', ...props.dataSet }}
      />
    </div>
  );
}
