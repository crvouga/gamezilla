import { observeElementResize } from './observe-element-resize';
/**
 * Floor-rounded live width of a DOM element (via `ResizeObserver`). Falls
 * back to a one-shot `getBoundingClientRect` where observers are missing
 * (tests / SSR), and stays `0` until the element mounts.
 */

import { type Accessor, createEffect, createSignal } from 'solid-js';

export function createElementWidth(
  el: Accessor<HTMLElement | null>
): Accessor<number> {
  const [width, setWidth] = createSignal(0);
  createEffect(el, (node) => {
    if (node === null) return undefined;
    const apply = (): void => {
      setWidth(Math.floor(node.getBoundingClientRect().width));
    };
    apply();
    return observeElementResize(node, apply);
  });
  return width;
}
