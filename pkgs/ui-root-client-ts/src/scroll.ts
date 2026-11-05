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
  /**
   * `page` (default): the browser's own reveal, which scrolls every
   * scrolling ancestor, the page included. `scroller`: only the nearest
   * ancestor that scrolls (a strip of moves) moves, so revealing an item
   * in a sideways strip never shifts the page itself. Here an axis
   * without an alignment (`block`, `inline`) does not move at all.
   */
  readonly scope?: 'page' | 'scroller' | undefined;
};

type Axis = 'x' | 'y';

/** The nearest ancestor of `element` that scrolls along `axis`. */
function nearestScroller(element: HTMLElement, axis: Axis): HTMLElement | null {
  for (let at = element.parentElement; at !== null; at = at.parentElement) {
    const style = getComputedStyle(at);
    const overflow = axis === 'x' ? style.overflowX : style.overflowY;
    const room =
      axis === 'x'
        ? at.scrollWidth > at.clientWidth
        : at.scrollHeight > at.clientHeight;
    if ((overflow === 'auto' || overflow === 'scroll') && room) return at;
  }
  return null;
}

/** Where `scroller` must scroll along `axis` to put `element` at `edge`. */
function alignedOffset(
  element: HTMLElement,
  scroller: HTMLElement,
  axis: Axis,
  edge: ScrollEdge
): number | null {
  const item = element.getBoundingClientRect();
  const view = scroller.getBoundingClientRect();
  const x = axis === 'x';
  const current = x ? scroller.scrollLeft : scroller.scrollTop;
  const size = x ? scroller.clientWidth : scroller.clientHeight;
  const start = (x ? item.left - view.left : item.top - view.top) + current;
  const length = x ? item.width : item.height;
  if (edge === 'start') return start;
  if (edge === 'end') return start + length - size;
  if (edge === 'center') return start - (size - length) / 2;
  if (start < current) return start;
  if (start + length > current + size) return start + length - size;
  return null;
}

/** Reveal `element` by moving only the ancestors that scroll it. */
function revealInScroller(
  element: HTMLElement,
  options: ScrollIntoViewOptions | undefined
): void {
  const behavior = options?.behavior ?? 'smooth';
  for (const [axis, edge] of [
    ['x', options?.inline],
    ['y', options?.block],
  ] as const) {
    if (edge === undefined) continue;
    const scroller = nearestScroller(element, axis);
    if (scroller === null) continue;
    const offset = alignedOffset(element, scroller, axis, edge);
    if (offset === null) continue;
    const to = Math.max(0, offset);
    // Some headless DOMs mount elements without `scrollTo`.
    const host: { scrollTo?: HTMLElement['scrollTo'] } = scroller;
    if (host.scrollTo === undefined) {
      if (axis === 'x') scroller.scrollLeft = to;
      else scroller.scrollTop = to;
    } else
      scroller.scrollTo(
        axis === 'x' ? { left: to, behavior } : { top: to, behavior }
      );
  }
}

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
      if (options?.scope === 'scroller') {
        revealInScroller(element, options);
        return true;
      }
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
