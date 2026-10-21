import { createFrameResizeObserver } from './observe-element-resize';
/**
 * Live widths of a changing set of DOM elements, keyed by id (one
 * `ResizeObserver` for all of them). A key keeps its last width after its
 * element unmounts, so an item that collapsed into a menu is still budgeted
 * at the width it had. A `0` width (not laid out, or a DOM without layout)
 * is reported as unknown.
 */

import { createSignal, onCleanup, onMount } from 'solid-js';

export type KeyedWidths = {
  /**
   * Track `el` under `key` until the calling owner is cleaned up. Call it from
   * a `ref` inside a component, so the first read waits for the mount.
   */
  track: (key: string, el: HTMLElement) => void;
  /** Last measured width for `key`, or `undefined` when never measured. */
  width: (key: string) => number | undefined;
};

export function createKeyedWidths(): KeyedWidths {
  const [widths, setWidths] = createSignal<ReadonlyMap<string, number>>(
    new Map()
  );
  const keys = new Map<Element, string>();
  const record = (el: Element): void => {
    const key = keys.get(el);
    if (key === undefined) return;
    const next = Math.ceil(el.getBoundingClientRect().width);
    if (next <= 0) return;
    setWidths((prev) => {
      if (prev.get(key) === next) return prev;
      const copy = new Map(prev);
      copy.set(key, next);
      return copy;
    });
  };
  let observer: ReturnType<typeof createFrameResizeObserver>;
  onCleanup(() => observer?.disconnect());
  return {
    track: (key, el) => {
      keys.set(el, key);
      const view = el.ownerDocument.defaultView;
      if (observer === undefined && view !== null) {
        observer = createFrameResizeObserver(view, (entries) => {
          for (const entry of entries) record(entry.target);
        });
      }
      observer?.observe(el);
      onMount(() => record(el));
      onCleanup(() => {
        observer?.unobserve(el);
        keys.delete(el);
      });
    },
    width: (key) => widths().get(key),
  };
}
