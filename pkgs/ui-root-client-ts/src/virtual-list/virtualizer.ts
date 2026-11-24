/**
 * Solid binding for `@tanstack/virtual-core`: the visible rows and the total
 * height as accessors, derived from the reactive list options and from what
 * the scroller reports (scroll offset, viewport and row measurements).
 */

import {
  elementScroll,
  observeElementOffset,
  observeElementRect,
  type VirtualItem,
  Virtualizer,
  type VirtualizerOptions,
} from '@tanstack/virtual-core';
import {
  type Accessor,
  createMemo,
  createSignal,
  onSettled,
  untrack,
} from 'solid-js';

export type { VirtualItem };

export type ListVirtualizerOptions = Pick<
  VirtualizerOptions<HTMLDivElement, HTMLDivElement>,
  'count' | 'estimateSize' | 'getScrollElement'
> &
  Partial<
    Pick<
      VirtualizerOptions<HTMLDivElement, HTMLDivElement>,
      'overscan' | 'gap' | 'getItemKey' | 'initialRect' | 'observeElementRect'
    >
  >;

export type ListVirtualizer = {
  /** Rows inside the viewport plus overscan, in order. */
  items: Accessor<readonly VirtualItem[]>;
  /** Height of every row, rendered or not. */
  totalSize: Accessor<number>;
  /** Reports a rendered row so its real height replaces the estimate. */
  measureElement: (element: HTMLDivElement) => void;
};

/** `options` is read reactively: a changed count, gap or overscan re-windows the list. */
export function createListVirtualizer(
  options: Accessor<ListVirtualizerOptions>
): ListVirtualizer {
  const [reports, setReports] = createSignal(0);
  let deriving = false;
  const resolved = (): VirtualizerOptions<HTMLDivElement, HTMLDivElement> => ({
    observeElementRect,
    observeElementOffset,
    scrollToFn: elementScroll,
    useAnimationFrameWithResizeObserver: true,
    ...options(),
    onChange: () => {
      // A report made while `items` derives is already part of that result.
      if (!deriving) setReports((count) => count + 1);
    },
  });
  // The options as they stand at creation: `items` applies every later change.
  const instance = new Virtualizer<HTMLDivElement, HTMLDivElement>(
    untrack(resolved)
  );
  const items = createMemo(
    (): readonly VirtualItem[] => {
      reports();
      deriving = true;
      try {
        instance.setOptions(resolved());
        instance._willUpdate();
        return instance.getVirtualItems();
      } finally {
        deriving = false;
      }
    },
    { equals: false }
  );
  const totalSize = createMemo(() => {
    items();
    return instance.getTotalSize();
  });
  onSettled(() => {
    const unmount = instance._didMount();
    instance._willUpdate();
    setReports((count) => count + 1);
    return unmount;
  });
  return {
    items,
    totalSize,
    measureElement: (element) => {
      instance.measureElement(element);
    },
  };
}
