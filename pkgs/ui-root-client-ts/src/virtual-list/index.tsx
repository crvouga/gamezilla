/** @jsxImportSource @solidjs/web */

import { ariaBoolean } from '@pkgs/ui-root-shared-ts/aria-boolean';
import { componentDataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import type { VirtualListViewport } from '@pkgs/ui-root-shared-ts/virtual-list-types';
import type { JSX } from '@solidjs/web';
import { createMemo, For, Show, untrack } from 'solid-js';
import { useContentEdgePadding } from '../content-edge-padding/index';
import { spaced } from '../layout-classes';
import type { ScrollFrameProps } from '../scroll-frame';
import { scrollFlush, scrollFrameClass, scrollHandlers } from '../scroll-frame';
import { useTestViewport } from '../test-viewport/index';
import styles from './virtual-list.module.css';
import {
  createListVirtualizer,
  type ListVirtualizer,
  type VirtualItem,
} from './virtualizer';

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
   * Draw the rows as one panel: the surface tone inside one hairline at
   * the card radius, hairlines between rows (the `MenuList` look), so a
   * long collection reads as one group like every other list.
   */
  panel?: boolean | undefined;
  /**
   * Draw the rows as several panels, one per group (a day of an inbox):
   * say where each row sits. A `heading` row above a group stays unpainted;
   * `first`, `middle`, `last` and `only` rows share their group's panel,
   * with hairlines between them. Takes the place of `panel`.
   */
  panelGroups?:
    | ((item: ItemT, index: number) => VirtualListPanelPlace)
    | undefined;
  /**
   * Fixed scroller size for environments without layout (tests). When set the
   * scroller box is not observed.
   */
  fixedViewport?: VirtualListViewport | undefined;
  /** A `listbox` that allows more than one selected option. */
  'aria-multiselectable'?: boolean | undefined;
};

/** Where a row sits in a grouped list: see {@link VirtualListProps.panelGroups}. */
export type VirtualListPanelPlace =
  | 'heading'
  | 'first'
  | 'middle'
  | 'last'
  | 'only';

const DEFAULT_ESTIMATE = 56;
/** A panel's hairline, top and bottom, around the measured rows. */
const PANEL_BORDER_PX = 2;

type RowsProps<ItemT> = {
  virtualizer: ListVirtualizer;
  items: readonly ItemT[];
  renderItem: (item: ItemT, index: number) => JSX.Element;
  panel: boolean;
  panelGroups:
    | ((item: ItemT, index: number) => VirtualListPanelPlace)
    | undefined;
};

/** The row's panel class and place, from `panel` or `panelGroups`. */
function rowPanel<ItemT>(
  props: RowsProps<ItemT>,
  row: ItemT,
  index: number
): { readonly class: string | undefined; readonly place: string | undefined } {
  const groups = props.panelGroups;
  if (groups === undefined) {
    return { class: props.panel ? 'panelItem' : undefined, place: undefined };
  }
  const place = groups(row, index);
  return {
    class: place === 'heading' ? undefined : styles['segment'],
    place,
  };
}

function VirtualRow<ItemT>(props: {
  rows: RowsProps<ItemT>;
  item: VirtualItem;
}): JSX.Element {
  // A row is a slot: it keeps its index while the data underneath changes
  // (filtered lists swap items without changing the slot) and while the
  // rows above it are measured, which moves its offset.
  const index = untrack(() => props.item.index);
  const data = createMemo(() => props.rows.items[index]);
  return (
    <Show when={data()} keyed>
      {(row) => (
        <div
          role="listitem"
          class={rowPanel(props.rows, row, index).class}
          data-panel-place={rowPanel(props.rows, row, index).place}
          data-index={index}
          ref={(el) =>
            queueMicrotask(() => props.rows.virtualizer.measureElement(el))
          }
          style={{
            position: 'absolute',
            top: '0',
            left: '0',
            width: '100%',
            transform: `translateY(${props.item.start}px)`,
          }}
        >
          {props.rows.renderItem(row, index)}
        </div>
      )}
    </Show>
  );
}

function VirtualRows<ItemT>(props: RowsProps<ItemT>): JSX.Element {
  // One panel around every row: `panel` without `panelGroups`.
  const outerPanel = (): boolean =>
    props.panel && props.panelGroups === undefined;
  return (
    <div
      role="list"
      class={outerPanel() ? 'panel' : undefined}
      style={{
        height: `${props.virtualizer.totalSize() + (outerPanel() ? PANEL_BORDER_PX : 0)}px`,
        position: 'relative',
        width: '100%',
      }}
    >
      <For each={props.virtualizer.items()} keyed={(item) => item.index}>
        {(item) => <VirtualRow rows={props} item={item()} />}
      </For>
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

function createVirtualizer<ItemT>(
  local: ListLocal<ItemT>,
  getScrollElement: () => HTMLDivElement | null,
  testViewport: VirtualListViewport | null
): ListVirtualizer {
  // Layout mode is decided once at mount. The test-host viewport fills in
  // for happy-dom (no ResizeObserver rects) when the prop is unset.
  const fixed = untrack(() => local.fixedViewport ?? testViewport);
  const estimate = (index: number): number => {
    const e = local.estimateSize;
    if (typeof e === 'function') return e(index);
    return e ?? DEFAULT_ESTIMATE;
  };
  return createListVirtualizer(() => ({
    count: local.items.length,
    overscan: local.overscan ?? 4,
    gap: local.gap ?? 0,
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
  }));
}

function fixedScrollerStyle(
  fixedHeight: number | undefined
): JSX.CSSProperties | undefined {
  return fixedHeight === undefined ? undefined : { height: `${fixedHeight}px` };
}

/**
 * `VirtualList` -- windowed vertical list over `@tanstack/virtual-core`.
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
  const virtualizer = createVirtualizer(
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
      aria-multiselectable={ariaBoolean(props['aria-multiselectable'])}
      tabindex={props.tabIndex}
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
            panel={props.panel === true}
            panelGroups={props.panelGroups}
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
