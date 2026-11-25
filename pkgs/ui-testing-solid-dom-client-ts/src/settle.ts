import { flush } from 'solid-js';

/**
 * Apply Solid's queued writes now. A browser applies them in the microtask
 * that follows each event it delivers, so two real events never share stale
 * state. Synthetic events dispatched back to back run in one task: the driver
 * settles after each of them, and before it reads the DOM.
 */
export function settle(): void {
  flush();
}

/** Deliver one event, then let the app react to it as a browser task would. */
export function dispatchSettled(target: EventTarget, event: Event): void {
  target.dispatchEvent(event);
  settle();
}
