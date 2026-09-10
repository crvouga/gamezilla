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
import { joinClass } from '../box/box';
import { VirtualList, type VirtualListProps } from '../virtual-list';

export type ScreenBodyVirtualListProps<ItemT> = VirtualListProps<ItemT>;

export function ScreenBodyVirtualList<ItemT>(
  props: ScreenBodyVirtualListProps<ItemT>
): JSX.Element {
  const [local, rest] = splitProps(props, ['class', 'dataSet']);
  return (
    <div class="flex-1 min-h-0">
      <VirtualList
        class={joinClass('flex-1', local.class)}
        dataSet={{ component: 'ScreenBodyVirtualList', ...local.dataSet }}
        {...rest}
      />
    </div>
  );
}
