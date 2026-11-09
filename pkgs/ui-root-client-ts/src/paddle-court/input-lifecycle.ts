import { createRenderEffect, onCleanup, onMount, untrack } from 'solid-js';
import type { CourtControls, CourtSide } from '../paddle-court-input';

/** An interruption ends held input; returning always requires a fresh action. */
export function useCourtInputLifecycle(
  props: CourtControls,
  release: (sides?: readonly CourtSide[]) => void
): void {
  let previous = { enabled: props.enabled, sides: [...props.controlled] };
  createRenderEffect(() => {
    const next = { enabled: props.enabled, sides: [...props.controlled] };
    if (
      previous.enabled &&
      (!next.enabled || previous.sides.join() !== next.sides.join())
    )
      untrack(() => release(previous.sides));
    previous = next;
  });
  onMount(() => {
    const blur = () => release();
    const visibility = () => {
      if (document.visibilityState === 'hidden') release();
    };
    window.addEventListener('blur', blur);
    document.addEventListener('visibilitychange', visibility);
    onCleanup(() => {
      window.removeEventListener('blur', blur);
      document.removeEventListener('visibilitychange', visibility);
    });
  });
}
