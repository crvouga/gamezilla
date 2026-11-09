import { BREAKPOINT_MIN_TABLET } from '@pkgs/ui-root-shared-ts/breakpoints';
import { spacing } from '@pkgs/ui-root-shared-ts/scale';
import { maxWidth } from '@pkgs/ui-root-shared-ts/sizes';
import { type Accessor, createEffect, createSignal, onCleanup } from 'solid-js';
import { createFrameResizeObserver } from '../observe-element-resize';

/** Scroll changes the view, not the stage's original height budget. */
function contentTop(stage: HTMLElement): number {
  let top = stage.getBoundingClientRect().top;
  for (let parent = stage.parentElement; parent; parent = parent.parentElement)
    top += parent.scrollTop;
  return top;
}

/**
 * Rows the layout puts under the stage (a phone or tablet's action row:
 * Offer draw, Resign) belong in the first view too. A row beside the stage
 * (a wide rail) starts above its bottom and is not counted.
 */
function belowStage(stage: HTMLElement, bottom: number): number {
  const cell = stage.parentElement;
  const layout = cell?.parentElement;
  if (!cell || !layout) return 0;
  const gap = Number.parseFloat(getComputedStyle(layout).rowGap) || 0;
  let below = 0;
  for (let row = cell.nextElementSibling; row; row = row.nextElementSibling) {
    const box = row.getBoundingClientRect();
    if (box.height > 0 && box.top >= bottom - 1) below += box.height + gap;
  }
  return below;
}

/** Ancestor/sibling resizes include banners and chrome preceding the stage. */
function layoutTargets(stage: HTMLElement): ReadonlySet<Element> {
  const targets = new Set<Element>();
  for (let node: Element | null = stage; node; node = node.parentElement) {
    targets.add(node);
    for (
      let sibling = node.previousElementSibling;
      sibling;
      sibling = sibling.previousElementSibling
    )
      targets.add(sibling);
  }
  return targets;
}

/**
 * Opt-in square content: subtract measured chrome from the viewport budget.
 * Width remains the parent's responsibility. Phone layouts retain their width;
 * a short viewport scrolls once the existing form measure is reached. No polling
 * or scroll listener: scrolling must never cause the board to grow or shrink.
 */
export function createViewportSquareFit(
  root: Accessor<HTMLElement | undefined>,
  enabled: Accessor<boolean>
): Accessor<number | undefined> {
  const [limit, setLimit] = createSignal<number>();
  createEffect(() => {
    if (!enabled()) {
      setLimit(undefined);
      return;
    }
    const stage = root();
    const view = stage?.ownerDocument.defaultView;
    if (!stage || !view) return;
    const read = () => {
      const rect = stage.getBoundingClientRect();
      if (view.innerWidth < BREAKPOINT_MIN_TABLET || rect.width <= 0) {
        setLimit(undefined);
        return;
      }
      const chrome = Math.max(0, rect.height - rect.width);
      const height = view.visualViewport?.height ?? view.innerHeight;
      const below = belowStage(stage, rect.bottom);
      const available =
        height - contentTop(stage) - chrome - below - spacing[4];
      setLimit(Math.max(maxWidth.form, Math.floor(available)));
    };
    read();
    const observer = createFrameResizeObserver(view, read);
    for (const target of layoutTargets(stage)) observer?.observe(target);
    for (
      let row = stage.parentElement?.nextElementSibling;
      row;
      row = row.nextElementSibling
    )
      observer?.observe(row);
    view.addEventListener('resize', read);
    view.visualViewport?.addEventListener('resize', read);
    stage.addEventListener('ui-testing:element-layout', read);
    onCleanup(() => {
      observer?.disconnect();
      view.removeEventListener('resize', read);
      view.visualViewport?.removeEventListener('resize', read);
      stage.removeEventListener('ui-testing:element-layout', read);
    });
  });
  return limit;
}
