/**
 * How an opaque handle reaches its element. Design-system internal: the
 * modules that own a handle (`focus.ts`, `scroll.ts`, `measure.ts`) create
 * one here, and the hosts that accept one (`Stack*`, `Surface`, `Pressable`,
 * `TextInput`) attach their element here. A screen only ever holds the
 * handle and the methods its owner exposes, never the element.
 */

import { type Accessor, createSignal, type Setter } from 'solid-js';

declare const HANDLE_KIND: unique symbol;

/**
 * A reference to "the element of whichever component this is handed to".
 * It has no members: nothing can be read off it.
 */
export type ElementHandle<Kind extends string> = {
  readonly [HANDLE_KIND]: Kind;
};

const SETTERS = new WeakMap<object, Setter<HTMLElement | undefined>>();

export type ElementHandleSource<Kind extends string> = {
  readonly handle: ElementHandle<Kind>;
  /** The attached element; `undefined` until a host mounts with the handle. */
  readonly element: Accessor<HTMLElement | undefined>;
};

export function createElementHandle<
  Kind extends string,
>(): ElementHandleSource<Kind> {
  const [element, setElement] = createSignal<HTMLElement>();
  const handle = Object.freeze({}) as ElementHandle<Kind>;
  SETTERS.set(handle, setElement);
  return { handle, element };
}

/** Point `handle` at `element`. The last host to attach wins. */
export function attachElement(
  handle: ElementHandle<string>,
  element: HTMLElement
): void {
  SETTERS.get(handle)?.(() => element);
}

/** Clear `handle` if it still points at `element`. */
export function detachElement(
  handle: ElementHandle<string>,
  element: HTMLElement
): void {
  SETTERS.get(handle)?.((current) =>
    current === element ? undefined : current
  );
}
