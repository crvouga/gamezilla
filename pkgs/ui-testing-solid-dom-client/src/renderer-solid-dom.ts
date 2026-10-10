/**
 * {@link RenderedApp} port over a Solid tree mounted in a DOM container.
 * Interactions go through `@testing-library/user-event` (click / type /
 * keyboard) and synthetic PointerEvents (coordinate taps, drags); layout is
 * synthesized when the host cannot measure.
 */

import type { ScrollDirection } from '@pkgs/ui-testing-root-shared/driver';
import type { RenderedApp } from '@pkgs/ui-testing-root-shared/render-adapter';
import { userEventKeyFromDom } from '@pkgs/ui-testing-solid-dom-shared/dom-keys';
import type { SerializeDomHtmlOptions } from '@pkgs/ui-testing-solid-dom-shared/serialize-dom-html';
import { serializeDomHtml } from '@pkgs/ui-testing-solid-dom-shared/serialize-dom-html';
import userEvent from '@testing-library/user-event';
import { fireDrag, fireTapAt } from './dom-gestures';
import type { LayoutProvider } from './dom-layout';
import { ensureElementLayout, synthesizeLayout } from './dom-layout';
import {
  ACTOR_ATTR,
  asElement,
  queryActorTestId,
  queryWithinTestId,
} from './dom-query';
import { fieldOf, isTextField, readDomText } from './dom-text';
import { isDomVisible } from './dom-visibility';
import { createLayoutSynchronizer } from './layout-synchronizer';
export type UserEvent = ReturnType<typeof userEvent.setup>;

export type SolidDomAppScope = {
  readonly document: Document;
  /** Live actor container while mounted; `null` while parked. */
  readonly container: () => HTMLElement | null;
  /** Make this actor the mounted one before interacting (multi-actor). */
  readonly activate?: (() => void | Promise<void>) | undefined;
  readonly unmount: () => void;
  readonly layoutProvider?: LayoutProvider | undefined;
  /** Shared user-event instance; defaults to one bound to `document`. */
  readonly user?: UserEvent | undefined;
};

/** Bind user-event to a document with no wall delays between key strokes. */
export function createDomUser(document: Document): UserEvent {
  return userEvent.setup({ document, delay: null });
}

/** Text field to type into: the node itself or its first `<input>` / `<textarea>`. */
function findTextField(
  element: Element
): HTMLInputElement | HTMLTextAreaElement {
  const own = fieldOf(element);
  if (own !== null) return own;
  const nested = element.querySelector('input, textarea');
  if (nested !== null && isTextField(nested)) return nested;
  throw new Error('solid-dom: no <input> / <textarea> under matched element');
}

const SCROLL_HOST_COMPONENT = /(Scroll|ScrollView|VirtualList)$/;

/** A design-system scroll host or anything with inline `overflow: auto|scroll`. */
function isScroller(element: Element): boolean {
  const component = element.getAttribute('data-component');
  if (component !== null && SCROLL_HOST_COMPONENT.test(component)) return true;
  if (!(element instanceof HTMLElement)) return false;
  const { overflow, overflowX, overflowY } = element.style;
  return [overflow, overflowX, overflowY].some(
    (value) => value === 'auto' || value === 'scroll'
  );
}

/**
 * Scroller for "scroll within (or toward) the element": the node itself, else
 * its first scroll host, else the nearest scrolling ancestor, else the node.
 */
function findScroller(element: Element): Element {
  if (isScroller(element)) return element;
  for (const candidate of element.querySelectorAll('*')) {
    if (isScroller(candidate)) return candidate;
  }
  let ancestor = element.parentElement;
  while (ancestor !== null) {
    if (isScroller(ancestor)) return ancestor;
    ancestor = ancestor.parentElement;
  }
  return element;
}

function scrollBy(
  element: Element,
  direction: ScrollDirection,
  amount: number
) {
  const target = findScroller(element);
  if (direction === 'down' || direction === 'up') {
    const delta = direction === 'down' ? amount : -amount;
    target.scrollTop = Math.max(0, target.scrollTop + delta);
  } else {
    const delta = direction === 'right' ? amount : -amount;
    target.scrollLeft = Math.max(0, target.scrollLeft + delta);
  }
  target.dispatchEvent(new Event('scroll', { bubbles: false }));
}

/**
 * Nodes that make up the actor's rendered UI: the container plus body-level
 * siblings that are not another actor's mount (Solid `<Portal>` defaults to
 * `document.body`).
 */
export function collectActorNodes(
  document: Document,
  container: HTMLElement
): readonly Element[] {
  const out: Element[] = [container];
  for (const child of document.body.children) {
    if (child === container || child.contains(container)) continue;
    if (child.hasAttribute(ACTOR_ATTR)) continue;
    if (child.querySelector(`[${ACTOR_ATTR}]`) !== null) continue;
    out.push(child);
  }
  return out;
}

export function snapshotActorHtml(
  document: Document,
  container: HTMLElement | null,
  options?: SerializeDomHtmlOptions
): string | undefined {
  if (container === null) return undefined;
  return serializeDomHtml(collectActorNodes(document, container), options);
}

/** {@link RenderedApp} whose optional members are always present. */
export type SolidDomRenderedApp = RenderedApp & {
  activate(): Promise<void>;
  snapshotHtml(options?: SerializeDomHtmlOptions): string | undefined;
};

/** Move focus into `element` (its text field when it wraps one). */
function focusInto(element: Element): void {
  if (element.contains(element.ownerDocument.activeElement)) return;
  const focusable = fieldOf(element) ?? element;
  if (focusable instanceof HTMLElement) focusable.focus();
}

/**
 * Replace the field value in one `input` event. Typing a letter at a time
 * lets virtual time between keys run a people search for each prefix.
 */
function writeFieldText(
  field: HTMLInputElement | HTMLTextAreaElement,
  text: string
): void {
  const prototype =
    field instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
  const set = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
  if (set === undefined) {
    field.value = text;
  } else {
    set.call(field, text);
  }
  field.dispatchEvent(new Event('input', { bubbles: true }));
}

export function createSolidDomRenderedApp(
  scope: SolidDomAppScope
): SolidDomRenderedApp {
  const user = scope.user ?? createDomUser(scope.document);
  const provider = scope.layoutProvider ?? synthesizeLayout;
  const layout = createLayoutSynchronizer(scope.container);
  const syncLayout = layout.sync;
  return {
    query: (testId) => {
      syncLayout();
      return queryActorTestId(scope.document, scope.container(), testId);
    },
    queryWithin: (parent, testId) =>
      queryWithinTestId(asElement(parent), testId),
    isVisible: (element) => isDomVisible(asElement(element)),
    getText: (element) => readDomText(asElement(element)),
    getAttribute: (element, name) => asElement(element).getAttribute(name),
    tap: async (element) => {
      syncLayout();
      ensureElementLayout(asElement(element), provider);
      await user.click(asElement(element));
      // Menus measure the trigger on open; re-layout so remounted anchors and
      // FloatingMenu listeners pick up trailing-edge boxes.
      syncLayout();
    },
    tapAt: (element, position, options) => {
      syncLayout();
      fireTapAt(asElement(element), position, provider, options);
      return Promise.resolve();
    },
    drag: (element, from, to, options) => {
      syncLayout();
      fireDrag(asElement(element), { from, to }, provider, options);
      return Promise.resolve();
    },
    layout: (element) => {
      syncLayout();
      return Promise.resolve(ensureElementLayout(asElement(element), provider));
    },
    typeText: (element, text) => {
      const field = findTextField(asElement(element));
      focusInto(field);
      writeFieldText(field, `${field.value}${text}`);
      return Promise.resolve();
    },
    clearText: (element) => {
      const field = findTextField(asElement(element));
      focusInto(field);
      writeFieldText(field, '');
      return Promise.resolve();
    },
    pressKey: async (domKey, target) => {
      if (target !== undefined) focusInto(asElement(target));
      await user.keyboard(userEventKeyFromDom(domKey));
    },
    scroll: (element, direction, amount) => {
      scrollBy(asElement(element), direction, amount);
      return Promise.resolve();
    },
    unmount: () => {
      layout.close();
      return scope.unmount();
    },
    snapshotHtml: (options) => {
      syncLayout();
      return snapshotActorHtml(scope.document, scope.container(), options);
    },
    activate: async () => {
      await scope.activate?.();
    },
  };
}
