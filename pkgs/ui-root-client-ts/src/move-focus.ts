import { untrack } from 'solid-js';

/**
 * Focus `element` from an effect or a settled callback. Design-system
 * internal.
 *
 * Focus and blur listeners run synchronously, inside the caller. `untrack`
 * keeps what they read their own: none of it counts as a read made by the
 * effect that moved focus.
 */
export function moveFocus(
  element: HTMLElement | null | undefined,
  options?: FocusOptions
): void {
  if (element === null || element === undefined) return;
  untrack(() => element.focus(options));
}

/** Blur `element` under the same terms as {@link moveFocus}. */
export function dropFocus(element: HTMLElement | null | undefined): void {
  if (element === null || element === undefined) return;
  untrack(() => element.blur());
}
