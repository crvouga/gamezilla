/**
 * The page a person's app is showing, and the keyboard on it. Everything a
 * listener hears and everywhere the keyboard lands is read off the live DOM
 * of the actor on screen (the in-process Solid DOM, or the product-harness's
 * browser document); a host without one (a Bun.WebView actor) is a host
 * limit.
 *
 * happy-dom dispatches key events but has no sequential focus navigation, so
 * Tab is pressed here as a browser does it: `keydown` on the focused element
 * and, unless the app cancels it, focus moves to the next stop of the HTML
 * sequential focus order (`@pkgs/a11y`), then `keyup`.
 */

import { describeControl } from '@pkgs/a11y-shared-ts/controls';
import {
  nextInFocusOrder,
  sequentialFocusOrder,
} from '@pkgs/a11y-shared-ts/focus';
import { hostLimit } from '@pkgs/gherkin-shared-ts/registry';
import { actorUi } from './actor-ui';
import type { ProductHarness } from './harness';
import { productExtra } from './harness';
import { bringToFront } from './observations';

/** The document body of `actorId`'s app, brought on screen. */
export async function actorPage(
  s: ProductHarness,
  actorId: string
): Promise<HTMLElement> {
  if (productExtra(s).ui.kind !== 'solid-dom') {
    throw hostLimit('this host does not expose the page a listener hears');
  }
  await actorUi(s, actorId);
  await bringToFront(s, actorId);
  const page = globalThis.document.body;
  if (page.querySelector(`[data-actor="${actorId}"]`) === null) {
    throw new Error(`${actorId}'s app is not on screen`);
  }
  return page;
}

/** The element the keyboard is on, or `null` at the start of the page. */
export function keyboardElement(page: HTMLElement): Element | null {
  const active = page.ownerDocument.activeElement;
  return active === null || active === page ? null : active;
}

/** Put the keyboard back at the start of the page (nothing focused). */
export function keyboardToStart(page: HTMLElement): void {
  const active = keyboardElement(page) as HTMLElement | null;
  active?.blur();
}

function keyEvent(page: HTMLElement, type: string, shiftKey: boolean): Event {
  const view = page.ownerDocument.defaultView as typeof globalThis | null;
  const Keyboard = view?.KeyboardEvent ?? KeyboardEvent;
  return new Keyboard(type, {
    key: 'Tab',
    code: 'Tab',
    shiftKey,
    bubbles: true,
    cancelable: true,
  });
}

/** One press of Tab (Shift+Tab when `backwards`), as a browser handles it. */
export async function pressTab(
  s: ProductHarness,
  page: HTMLElement,
  backwards = false
): Promise<void> {
  const from = keyboardElement(page) ?? page;
  const proceed = from.dispatchEvent(keyEvent(page, 'keydown', backwards));
  if (proceed) {
    const next = nextInFocusOrder(page, keyboardElement(page), backwards);
    if (next === null) keyboardToStart(page);
    else (next as HTMLElement).focus();
  }
  (keyboardElement(page) ?? page).dispatchEvent(
    keyEvent(page, 'keyup', backwards)
  );
  await s.session.waitForIdle();
}

/**
 * Where the keyboard is, as a person would say it: the screen it is on and
 * the control it is on (`spaces: button "Account menu"`), or `null` when it
 * is on nothing.
 */
export function keyboardPlace(page: HTMLElement): string | null {
  const element = keyboardElement(page);
  return element === null ? null : placeOf(element);
}

/** A control as a person places it: its screen, its role and its name. */
export function placeOf(element: Element): string {
  const screen =
    element.closest('[data-screen]')?.getAttribute('data-screen') ?? 'app';
  return `${screen}: ${describeControl(element)}`;
}

/** Tab through the live focus order to a control, with at most one lap. */
export async function tabTo(
  s: ProductHarness,
  actorId: string,
  testId: string
): Promise<void> {
  const page = await actorPage(s, actorId);
  const lap = sequentialFocusOrder(page).length + 1;
  for (let press = 0; press <= lap; press += 1) {
    if (keyboardElement(page)?.getAttribute('data-testid') === testId) return;
    await pressTab(s, page);
  }
  throw new Error(`${actorId}'s keyboard never reached ${testId}`);
}
