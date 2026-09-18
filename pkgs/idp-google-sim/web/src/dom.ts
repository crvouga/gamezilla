/**
 * The only module in the SPA that touches the document.
 *
 * Route components pass their own events in and the app calls these after a
 * step change, so nothing under `web/src/routes` reads `document` itself.
 */

import { IDP_SCREEN_REGION_ID } from '../../src/shared/screen-state';

/** Move focus to the new screen's first field, else to the card region. */
export function focusScreen(): void {
  const region = document.getElementById(IDP_SCREEN_REGION_ID);
  if (region === null) return;
  const field = region.querySelector('input:not([type="hidden"])');
  if (field instanceof HTMLElement) {
    field.focus();
    return;
  }
  region.focus();
}

/**
 * The value of a named field in the form a submit handler belongs to. The
 * screens never hold a reference to an input: the same markup is serialized
 * without JavaScript, so the form *is* the source of truth.
 */
export function fieldValueOf(event: Event, name: string): string {
  const form = event.currentTarget;
  if (!(form instanceof HTMLFormElement)) return '';
  const field = form.elements.namedItem(name);
  return field instanceof HTMLInputElement ? field.value : '';
}

type Move = (index: number, last: number) => number;

const MOVES: Record<string, Move> = {
  ArrowDown: (index, last) => Math.min(index + 1, last),
  ArrowUp: (index) => Math.max(index - 1, 0),
  Home: () => 0,
  End: (_index, last) => last,
};

/** Arrow / Home / End movement between the chooser's account rows. */
export function moveRovingFocus(
  event: KeyboardEvent,
  container: HTMLFormElement
): void {
  const move = MOVES[event.key];
  if (move === undefined) return;
  const rows = Array.from(
    container.querySelectorAll<HTMLElement>('button[name]')
  );
  const index = rows.indexOf(document.activeElement as HTMLElement);
  if (index < 0) return;
  event.preventDefault();
  rows[move(index, rows.length - 1)]?.focus();
}
