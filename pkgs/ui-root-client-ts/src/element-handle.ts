/**
 * How an opaque handle reaches its element. Design-system internal: the
 * modules that own a handle (`focus.ts`, `scroll.ts`, `measure.ts`) create
 * one here, and the hosts that accept one (`Stack*`, `Surface`, `Pressable`,
 * `TextInput`, `Button`) attach their element here. A screen only ever holds the
 * handle and the methods its owner exposes, never the element.
 */

import { type Accessor, createSignal } from 'solid-js';

declare const HANDLE_KIND: unique symbol;

/**
 * A reference to "the element of whichever component this is handed to".
 * It has no members: nothing can be read off it.
 */
export type ElementHandle<Kind extends string> = {
  readonly [HANDLE_KIND]: Kind;
};

type Attachment = {
  readonly attach: (element: HTMLElement) => void;
  readonly detach: (element: HTMLElement) => void;
};

const ATTACHMENTS = new WeakMap<object, Attachment>();

export type ElementHandleSource<Kind extends string> = {
  readonly handle: ElementHandle<Kind>;
  /**
   * The attached element; `undefined` until a host mounts with the handle.
   * Tracked: read it where a change of host must be followed.
   */
  readonly element: Accessor<HTMLElement | undefined>;
  /**
   * The attached element right now, untracked: what a method that acts on
   * the element (focus it, scroll to it) reads when it is called.
   */
  readonly current: () => HTMLElement | undefined;
};

export function createElementHandle<
  Kind extends string,
>(): ElementHandleSource<Kind> {
  // The element is held outside the signal: a host attaches while it
  // renders, and an owner that acts in the same pass (scrolls to the move
  // just selected) must reach that element, not the one a signal still
  // reports until the pass commits. The signal only tells readers to look.
  let current: HTMLElement | undefined;
  const [attached, setAttached] = createSignal<HTMLElement>();
  const handle = Object.freeze({}) as ElementHandle<Kind>;
  ATTACHMENTS.set(handle, {
    attach: (element) => {
      current = element;
      setAttached(() => element);
    },
    detach: (element) => {
      if (current !== element) return;
      current = undefined;
      setAttached(undefined);
    },
  });
  const element = (): HTMLElement | undefined => {
    attached();
    return current;
  };
  return { handle, element, current: () => current };
}

/** Point `handle` at `element`. The last host to attach wins. */
export function attachElement(
  handle: ElementHandle<string>,
  element: HTMLElement
): void {
  ATTACHMENTS.get(handle)?.attach(element);
}

/** Clear `handle` if it still points at `element`. */
export function detachElement(
  handle: ElementHandle<string>,
  element: HTMLElement
): void {
  ATTACHMENTS.get(handle)?.detach(element);
}
