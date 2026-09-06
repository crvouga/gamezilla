/**
 * Floor-rounded live width of a DOM element (via `ResizeObserver`). Falls
 * back to a one-shot `getBoundingClientRect` where observers are missing
 * (tests / SSR), and stays `0` until the element mounts.
 */

import { type Accessor, createEffect, createSignal, onCleanup } from 'solid-js';

export function createElementWidth(
  el: Accessor<HTMLElement | null>
): Accessor<number> {
  const [width, setWidth] = createSignal(0);
  createEffect(() => {
    const node = el();
    if (node === null) return;
    const apply = (): void => {
      const next = Math.floor(node.getBoundingClientRect().width);
      setWidth((prev) => (prev === next ? prev : next));
    };
    apply();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(apply);
    ro.observe(node);
    onCleanup(() => ro.disconnect());
  });
  return width;
}
