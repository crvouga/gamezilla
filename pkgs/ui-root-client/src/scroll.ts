/**
 * Scrolling a component into view without a DOM `ref`.
 *
 * A screen creates a target, hands `target` to the component that should be
 * revealed through its `scrollTarget` prop, and calls `scrollIntoView()`.
 *
 * ```tsx
 * const current = createScrollTarget();
 * createEffect(() => {
 *   selectedIndex();
 *   current.scrollIntoView({ inline: 'center', block: 'nearest' });
 * });
 * <For each={moves()}>
 *   {(move, index) => (
 *     <StackHorizontal scrollTarget={index() === selectedIndex() ? current.target : undefined}>
 *       …
 *     </StackHorizontal>
 *   )}
 * </For>
 * ```
 *
 * `scrollIntoView()` reads the attachment reactively: inside `createEffect`
 * it runs again when the target moves to another component, so the newly
 * selected item is revealed without timing code.
 */

import type { ElementHandle } from './element-handle';
import { createElementHandle } from './element-handle';

export type ScrollTarget = ElementHandle<'scroll'>;

export type ScrollEdge = 'start' | 'center' | 'end' | 'nearest';

export type ScrollIntoViewOptions = {
  /** `smooth` (default) animates; `instant` jumps. */
  readonly behavior?: 'smooth' | 'instant' | undefined;
  /** Vertical alignment in the scroller. Default `nearest`. */
  readonly block?: ScrollEdge | undefined;
  /** Horizontal alignment in the scroller. Default `nearest`. */
  readonly inline?: ScrollEdge | undefined;
};

export type ScrollHandle = {
  /** Give to exactly one component's `scrollTarget` prop. */
  readonly target: ScrollTarget;
  /** Reveal the target. `false` while no component holds it. */
  readonly scrollIntoView: (options?: ScrollIntoViewOptions) => boolean;
};

export function createScrollTarget(): ScrollHandle {
  const source = createElementHandle<'scroll'>();
  return {
    target: source.handle,
    scrollIntoView(options) {
      const element = source.element();
      if (element === undefined) return false;
      // Some headless DOMs mount elements without `scrollIntoView`.
      const host: { scrollIntoView?: HTMLElement['scrollIntoView'] } = element;
      if (host.scrollIntoView === undefined) return false;
      element.scrollIntoView({
        behavior: options?.behavior ?? 'smooth',
        block: options?.block ?? 'nearest',
        inline: options?.inline ?? 'nearest',
      });
      return true;
    },
  };
}
