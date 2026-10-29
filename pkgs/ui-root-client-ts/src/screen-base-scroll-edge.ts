import { type Accessor, createSignal, onCleanup, onMount } from 'solid-js';
import { bodyScrolledPastTop } from './screen-base-logic';

/**
 * Whether any vertical scroller inside `root` has scrolled off its top: the
 * whole-body `ScrollView` or a nested list scroller alike. Scroll events do
 * not bubble, so one capture-phase listener on the screen root hears every
 * scroller under it without the screen wiring anything.
 */
export function useBodyScrolled(
  root: () => HTMLElement | undefined
): Accessor<boolean> {
  const [scrolled, setScrolled] = createSignal(false);
  onMount(() => {
    const host = root();
    if (host === undefined) return;
    const onScroll = (event: Event): void => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const next = bodyScrolledPastTop(target);
      if (next !== undefined) setScrolled(next);
    };
    host.addEventListener('scroll', onScroll, { capture: true, passive: true });
    onCleanup(() =>
      host.removeEventListener('scroll', onScroll, { capture: true })
    );
  });
  return scrolled;
}
