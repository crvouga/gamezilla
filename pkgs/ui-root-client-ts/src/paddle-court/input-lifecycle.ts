import { createRenderEffect, onSettled, untrack } from 'solid-js';
import type { CourtControls, CourtSide } from '../paddle-court-input';

const PADDLE_KEYS = new Set(['arrowup', 'arrowdown', 'w', 's']);

/** An interruption ends held input; returning always requires a fresh action. */
export function useCourtInputLifecycle(
  props: CourtControls,
  release: (sides?: readonly CourtSide[]) => void,
  court: () => HTMLElement | undefined
): void {
  createRenderEffect(
    () => ({ enabled: props.enabled, sides: [...props.controlled] }),
    (next, previous) => {
      if (
        previous?.enabled === true &&
        (!next.enabled || previous.sides.join() !== next.sides.join())
      )
        // The host's handlers are called, not followed.
        untrack(() => release(previous.sides));
    }
  );
  onSettled(() => {
    const blur = () => release();
    const visibility = () => {
      if (document.visibilityState === 'hidden') release();
    };
    // A paddle key pressed while nothing has focus goes to the court, so
    // play starts without first tabbing to it. Focus anywhere else (a
    // field, a dialog, a button) keeps its keys.
    const enter = (event: KeyboardEvent) => {
      const target = court();
      const name = event.key.toLowerCase();
      if (
        target === undefined ||
        !props.enabled ||
        props.controlled.length === 0 ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        // Only keys aimed at nothing in particular: the page itself.
        (event.target !== document.body &&
          event.target !== document.documentElement) ||
        !PADDLE_KEYS.has(name) ||
        // W and S move only the left paddle.
        ((name === 'w' || name === 's') && !props.controlled.includes('first'))
      )
        return;
      event.preventDefault();
      target.focus();
      target.dispatchEvent(
        new KeyboardEvent('keydown', { key: event.key, bubbles: true })
      );
    };
    window.addEventListener('blur', blur);
    document.addEventListener('visibilitychange', visibility);
    document.addEventListener('keydown', enter);
    return () => {
      window.removeEventListener('blur', blur);
      document.removeEventListener('visibilitychange', visibility);
      document.removeEventListener('keydown', enter);
    };
  });
}
