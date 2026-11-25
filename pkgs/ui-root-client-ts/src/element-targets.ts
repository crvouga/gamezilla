/**
 * The handle props a host accepts, and the one call that attaches its
 * element to them. Design-system internal.
 */

import { createRenderEffect, onCleanup, untrack } from 'solid-js';
import type { ElementHandle } from './element-handle';
import { attachElement, detachElement } from './element-handle';
import type { FocusTarget } from './focus';
import type { MeasureTarget } from './measure';
import type { ScrollTarget } from './scroll';

export type ElementTargetProps = {
  /** From `createFocusTarget()`: lets the screen move focus here. */
  focusTarget?: FocusTarget | undefined;
  /** From `createScrollTarget()`: lets the screen scroll this into view. */
  scrollTarget?: ScrollTarget | undefined;
  /** From `createMeasure()`: reports this component's rendered size. */
  measureTarget?: MeasureTarget | undefined;
};

const TARGET_KEYS = ['focusTarget', 'scrollTarget', 'measureTarget'] as const;

/** The `ref` callback a host hands its element to. */
export type ElementRef = (element: HTMLElement) => void;

const NO_TARGETS: ElementRef = () => undefined;

function currentHandles(targets: ElementTargetProps): ElementHandle<string>[] {
  const handles: ElementHandle<string>[] = [];
  for (const key of TARGET_KEYS) {
    const handle = targets[key];
    if (handle !== undefined) handles.push(handle);
  }
  return handles;
}

/**
 * A `ref` callback that attaches the host's element to whichever handles
 * `targets` carries, following them as they change. Call in the component
 * body (`ref={bindElementTargets(props)}`): a ref callback owns nothing, so
 * the effect that follows the handles is created here. A host written
 * without any target prop pays nothing: no effect is created.
 */
export function bindElementTargets(targets: ElementTargetProps): ElementRef {
  // Which target props a host was written with is its shape, read once.
  if (!untrack(() => TARGET_KEYS.some((key) => key in targets)))
    return NO_TARGETS;
  let element: HTMLElement | undefined;
  let wanted: ElementHandle<string>[] = [];
  let attached: ElementHandle<string>[] = [];
  const sync = (): void => {
    const host = element;
    if (host === undefined) return;
    const next = wanted;
    for (const handle of attached) {
      if (!next.includes(handle)) detachElement(handle, host);
    }
    for (const handle of next) attachElement(handle, host);
    attached = next;
  };
  createRenderEffect(() => {
    wanted = currentHandles(targets);
    return wanted;
  }, sync);
  onCleanup(() => {
    wanted = [];
    sync();
  });
  return (host) => {
    element = host;
    sync();
  };
}
