/**
 * Reading a component's rendered size without a DOM `ref`.
 *
 * A screen creates a measure, hands `target` to a component through its
 * `measureTarget` prop, and reads `width()` / `height()`: whole CSS px,
 * `0` until the component is laid out, updated as it resizes.
 *
 * ```tsx
 * const frame = createMeasure();
 * const board = () => Math.min(frame.width(), frame.height());
 * <StackVertical grow align="center" justify="center" measureTarget={frame.target}>
 *   <Show when={board() > 0}>
 *     <ChessBoard size={board()} />
 *   </Show>
 * </StackVertical>
 * ```
 */

import { type Accessor, createEffect, createSignal, onCleanup } from 'solid-js';
import type { ElementHandle } from './element-handle';
import { createElementHandle } from './element-handle';

export type MeasureTarget = ElementHandle<'measure'>;

export type Measure = {
  /** Give to exactly one component's `measureTarget` prop. */
  readonly target: MeasureTarget;
  /** Border-box width in whole CSS px. Reactive. */
  readonly width: Accessor<number>;
  /** Border-box height in whole CSS px. Reactive. */
  readonly height: Accessor<number>;
};

/**
 * Dispatched on an element by headless test drivers once they have assigned
 * it a layout box: the one resize signal a DOM without layout can give.
 */
const ELEMENT_LAYOUT_EVENT = 'ui-testing:element-layout';

export function createMeasure(): Measure {
  const source = createElementHandle<'measure'>();
  const [width, setWidth] = createSignal(0);
  const [height, setHeight] = createSignal(0);
  createEffect(() => {
    const element = source.element();
    if (element === undefined) return;
    const read = (): void => {
      const rect = element.getBoundingClientRect();
      setWidth(Math.floor(rect.width));
      setHeight(Math.floor(rect.height));
    };
    read();
    element.addEventListener(ELEMENT_LAYOUT_EVENT, read);
    const observer =
      typeof ResizeObserver === 'undefined'
        ? undefined
        : new ResizeObserver(read);
    observer?.observe(element);
    onCleanup(() => {
      element.removeEventListener(ELEMENT_LAYOUT_EVENT, read);
      observer?.disconnect();
    });
  });
  return { target: source.handle, width, height };
}
