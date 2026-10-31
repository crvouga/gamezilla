/** @jsxImportSource solid-js */

import { componentDataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import type { VirtualListViewport } from '@pkgs/ui-root-shared-ts/virtual-list-types';
import {
  createVirtualizer,
  type VirtualItem,
  type Virtualizer,
} from '@tanstack/solid-virtual';
import { createMemo, For, type JSX, Show, untrack } from 'solid-js';
import { useContentEdgePadding } from '../content-edge-padding/index';
import { spaced } from '../layout-classes';
import type { ScrollFrameProps } from '../scroll-frame';
import { scrollFlush, scrollFrameClass, scrollHandlers } from '../scroll-frame';
import { useTestViewport } from '../test-viewport/index';

export type VirtualListProps<ItemT> = ScrollFrameProps & {
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
  /**
   * Fixed scroller size for environments without layout (tests). When set the
   * scroller box is not observed.
   */
  fixedViewport?: VirtualListViewport | undefined;
  /** A `listbox` that allows more than one selected option. */
  'aria-multiselectable'?: boolean | undefined;
};

const DEFAULT_ESTIMATE = 56;

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
    useAnimationFrameWithResizeObserver: true,
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

function fixedScrollerStyle(
  fixedHeight: number | undefined
): JSX.CSSProperties | undefined {
  return fixedHeight === undefined ? undefined : { height: `${fixedHeight}px` };
}

/**
 * `VirtualList` -- windowed vertical list over `@tanstack/solid-virtual`.
 *
 * Only rows inside the viewport (plus overscan) touch the DOM. Rows are
 * measured after paint so variable heights work; pass `estimateSize` close to
 * the common row height to minimise scroll jumps. Inside a padded shell the
 * scroller bleeds under the shell edge padding like `ScrollView`.
 */
export function VirtualList<ItemT>(
  props: VirtualListProps<ItemT>
): JSX.Element {
  const edge = useContentEdgePadding();
  let scroller: HTMLDivElement | undefined;
  const testViewport = useTestViewport();
  const virtualizer = createListVirtualizer(
    props,
    () => scroller ?? null,
    testViewport
  );
  const flush = () => scrollFlush(edge, props);
  const fixedHeight = untrack(() => props.fixedViewport?.height);

  const list = (
    <div
      ref={(el) => {
        scroller = el;
        props.ref?.(el);
      }}
      class={spaced(['scroll', scrollFrameClass(props)])}
      style={fixedScrollerStyle(fixedHeight)}
      {...componentDataAttrs('VirtualList', props.dataSet)}
      id={props.id}
      role={props.role}
      aria-label={props['aria-label']}
      aria-labelledby={props['aria-labelledby']}
      aria-multiselectable={props['aria-multiselectable']}
      tabIndex={props.tabIndex}
      {...scrollHandlers(props)}
    >
      <div
        class={spaced(['scrollContent', flush().contentClass])}
        data-component="VirtualListContent"
      >
        {props.header}
        <Show when={props.items.length > 0} fallback={props.empty}>
          <VirtualRows
            virtualizer={virtualizer}
            items={props.items}
            renderItem={props.renderItem}
          />
        </Show>
        {props.footer}
      </div>
    </div>
  );

  return (
    <Show when={flush().wrapperClass} fallback={list}>
      {(wrapperClass) => (
        <div class={wrapperClass()} style={flush().wrapperStyle}>
          {list}
        </div>
      )}
    </Show>
  );
}
