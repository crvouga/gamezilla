/** @jsxImportSource solid-js */
import { Trans } from '@lingui/solid/macro';
import { createVirtualizer } from '@tanstack/solid-virtual';
import { For, untrack } from 'solid-js';

export type ViewportRect = { width: number; height: number };

export type VirtualizedListProps = {
  count: number;
  rowHeight?: number;
  renderRow: (index: number) => string;
  /**
   * Fixed scroller size. When set the list does not observe the scroller's
   * layout box (also keeps DOM shims without layout deterministic).
   * When omitted the scroller fills its parent and is measured live.
   */
  fixedViewport?: ViewportRect;
};

const DEFAULT_ROW_HEIGHT = 40;

/**
 * Exemplar: `@tanstack/solid-virtual` windowing + `<For>` over the virtual
 * items. Only rows inside the viewport (plus overscan) touch the DOM.
 */
export function VirtualizedList(props: VirtualizedListProps) {
  let scroller: HTMLDivElement | undefined;
  const rowHeight = () => props.rowHeight ?? DEFAULT_ROW_HEIGHT;
  // Layout mode is decided once at mount; `untrack` makes that explicit.
  const fixed = untrack(() => props.fixedViewport);

  const virtualizer = createVirtualizer<HTMLDivElement, HTMLDivElement>({
    get count() {
      return props.count;
    },
    getScrollElement: () => scroller ?? null,
    estimateSize: rowHeight,
    overscan: 2,
    ...(fixed === undefined
      ? {}
      : {
          initialRect: fixed,
          observeElementRect: (_instance, cb) => {
            cb(fixed);
          },
        }),
  });

  return (
    <div
      ref={scroller}
      data-component="VirtualizedList"
      data-testid="virtualized-list"
      role="list"
      aria-label="Virtualized rows"
      style={{
        height: fixed === undefined ? '100%' : `${fixed.height}px`,
        overflow: 'auto',
      }}
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          position: 'relative',
        }}
      >
        <For each={virtualizer.getVirtualItems()}>
          {(item) => (
            <div
              role="listitem"
              data-index={item.index}
              style={{
                position: 'absolute',
                top: '0',
                left: '0',
                width: '100%',
                height: `${item.size}px`,
                transform: `translateY(${item.start}px)`,
              }}
            >
              <Trans>
                Row {item.index}: {props.renderRow(item.index)}
              </Trans>
            </div>
          )}
        </For>
      </div>
    </div>
  );
}
