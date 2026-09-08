/** @jsxImportSource solid-js */
/**
 * `VirtualList` -- windowed vertical list over `@tanstack/solid-virtual`.
 *
 * Only rows inside the viewport (plus overscan) touch the DOM. Rows are
 * measured after paint so variable heights work; pass `estimateSize` close to
 * the common row height to minimise scroll jumps. Inside a padded shell the
 * scroller bleeds under the shell edge padding like `ScrollView`.
 */

import {
  createVirtualizer,
  type VirtualItem,
  type Virtualizer,
} from '@tanstack/solid-virtual';
import { createMemo, For, type JSX, Show, splitProps, untrack } from 'solid-js';
import { type ComponentDataSet, componentDataAttrs } from '../../component-id';
import { flattenSx, type SxInput, useThemeTokens } from '../../theme';
import { Box, joinClass } from '../box/box';
import {
  resolveFlushEdgeStyles,
  useContentEdgePadding,
} from '../content-edge-padding';
import styles from '../hosts.module.css';
import type { VirtualListViewport } from './virtual-list-types';

export type { VirtualListViewport };
import { useTestViewport } from './test-viewport';

export type VirtualListProps<ItemT> = Omit<
  JSX.HTMLAttributes<HTMLDivElement>,
  'style' | 'children'
> & {
  items: readonly ItemT[];
  /** Stable key per item (used for row identity + measurement cache). */
  keyExtractor: (item: ItemT, index: number) => string;
  renderItem: (item: ItemT, index: number) => JSX.Element;
  /** Estimated row height in px. Defaults to 56. */
  estimateSize?: number | ((index: number) => number) | undefined;
  /** Rows rendered outside the viewport on each side. Defaults to 4. */
  overscan?: number | undefined;
  /** Gap between rows in px. */
  gap?: number | undefined;
  /** Rendered above the rows (scrolls with them). */
  header?: JSX.Element | undefined;
  /** Rendered below the rows (scrolls with them). */
  footer?: JSX.Element | undefined;
  /** Rendered instead of rows when `items` is empty. */
  empty?: JSX.Element | undefined;
  /** Utility-first style shorthand applied to the content container. */
  sx?: SxInput | undefined;
  /** Style the scroller frame (flex, maxHeight, …). */
  frameSx?: SxInput | undefined;
  /** Cancel shell edge padding so the scrollbar is flush. Default `true`. */
  flushEdge?: boolean | undefined;
  /**
   * Fixed scroller size for environments without layout (tests). When set the
   * scroller box is not observed.
   */
  fixedViewport?: VirtualListViewport | undefined;
  /** DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet | undefined;
  class?: string | undefined;
  ref?: ((el: HTMLDivElement) => void) | undefined;
};

const DEFAULT_ESTIMATE = 56;

function requestsFlexFill(frameSx: SxInput): boolean {
  const flat = flattenSx(frameSx);
  return flat?.flex === 1 || flat?.flexGrow === 1;
}

type RowsProps<ItemT> = {
  virtualizer: Virtualizer<HTMLDivElement, HTMLDivElement>;
  items: readonly ItemT[];
  renderItem: (item: ItemT, index: number) => JSX.Element;
};

function VirtualRows<ItemT>(props: RowsProps<ItemT>): JSX.Element {
  const virtualItems = createMemo(() => props.virtualizer.getVirtualItems());
  const renderRow = (item: VirtualItem): JSX.Element => {
    // The virtualizer reuses `VirtualItem` objects for unchanged slots, so the
    // row content must track the item at that index (filtered lists swap the
    // data underneath without changing the slot).
    const data = createMemo(() => props.items[item.index]);
    return (
      <Show when={data()} keyed>
        {(row) => (
          <div
            role="listitem"
            data-index={item.index}
            ref={(el) =>
              queueMicrotask(() => props.virtualizer.measureElement(el))
            }
            style={{
              position: 'absolute',
              top: '0',
              left: '0',
              width: '100%',
              transform: `translateY(${item.start}px)`,
            }}
          >
            {props.renderItem(row, item.index)}
          </div>
        )}
      </Show>
    );
  };
  return (
    <div
      role="list"
      style={{
        height: `${props.virtualizer.getTotalSize()}px`,
        position: 'relative',
        width: '100%',
      }}
    >
      <For each={virtualItems()}>{(item) => renderRow(item)}</For>
    </div>
  );
}

type ListLocal<ItemT> = Pick<
  VirtualListProps<ItemT>,
  | 'items'
  | 'keyExtractor'
  | 'estimateSize'
  | 'overscan'
  | 'gap'
  | 'fixedViewport'
>;

function createListVirtualizer<ItemT>(
  local: ListLocal<ItemT>,
  getScrollElement: () => HTMLDivElement | null,
  testViewport: VirtualListViewport | null
): Virtualizer<HTMLDivElement, HTMLDivElement> {
  // Layout mode is decided once at mount. The test-host viewport fills in
  // for happy-dom (no ResizeObserver rects) when the prop is unset.
  const fixed = untrack(() => local.fixedViewport ?? testViewport);
  const estimate = (index: number): number => {
    const e = local.estimateSize;
    if (typeof e === 'function') return e(index);
    return e ?? DEFAULT_ESTIMATE;
  };
  return createVirtualizer<HTMLDivElement, HTMLDivElement>({
    get count() {
      return local.items.length;
    },
    get overscan() {
      return local.overscan ?? 4;
    },
    get gap() {
      return local.gap ?? 0;
    },
    getScrollElement,
    estimateSize: estimate,
    getItemKey: (index) => {
      const item = local.items[index];
      return item === undefined ? index : local.keyExtractor(item, index);
    },
    ...(fixed === null
      ? {}
      : {
          initialRect: fixed,
          observeElementRect: (_instance, cb) => {
            cb(fixed);
          },
        }),
  });
}

export function VirtualList<ItemT>(
  props: VirtualListProps<ItemT>
): JSX.Element {
  const tokens = useThemeTokens();
  const edge = useContentEdgePadding();
  const [local, rest] = splitProps(props, [
    'items',
    'keyExtractor',
    'renderItem',
    'estimateSize',
    'overscan',
    'gap',
    'header',
    'footer',
    'empty',
    'sx',
    'frameSx',
    'flushEdge',
    'fixedViewport',
    'dataSet',
    'class',
    'ref',
  ]);
  let scroller: HTMLDivElement | undefined;
  const testViewport = useTestViewport();
  const virtualizer = createListVirtualizer(
    local,
    () => scroller ?? null,
    testViewport
  );
  const flush = () => resolveFlushEdgeStyles(edge, local.flushEdge ?? true);
  const fixedHeight = untrack(() => local.fixedViewport?.height);

  const list = (
    <div
      ref={(el) => {
        scroller = el;
        local.ref?.(el);
      }}
      class={joinClass(styles['scroll'], local.class)}
      style={
        tokens.css([
          fixedHeight === undefined ? false : { height: fixedHeight },
          local.frameSx,
        ]) || undefined
      }
      {...componentDataAttrs('VirtualList', local.dataSet)}
      {...rest}
    >
      <div
        class={styles['scrollContent']}
        style={tokens.css([flush().contentSx, local.sx]) || undefined}
        data-component="VirtualListContent"
      >
        {local.header}
        <Show when={local.items.length > 0} fallback={local.empty}>
          <VirtualRows
            virtualizer={virtualizer}
            items={local.items}
            renderItem={local.renderItem}
          />
        </Show>
        {local.footer}
      </div>
    </div>
  );

  return (
    <Show when={flush().wrapperSx} fallback={list}>
      {(wrapperSx) => (
        <Box
          sx={
            requestsFlexFill(local.frameSx)
              ? { ...wrapperSx(), flex: 1 }
              : wrapperSx()
          }
        >
          {list}
        </Box>
      )}
    </Show>
  );
}
