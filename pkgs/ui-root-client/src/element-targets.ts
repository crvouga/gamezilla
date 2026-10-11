/**
 * The handle props a host accepts, and the one call that attaches its
 * element to them. Design-system internal.
 */

import { createRenderEffect, onCleanup } from 'solid-js';
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

/**
 * Attach `element` to whichever handles `targets` carries, following them
 * as they change. Call from the host's `ref`. A host written without any
 * target prop pays nothing: no effect is created.
 */
export function bindElementTargets(
  element: HTMLElement,
  targets: ElementTargetProps
): void {
  if (!TARGET_KEYS.some((key) => key in targets)) return;
  createRenderEffect(() => {
    const handles: ElementHandle<string>[] = [];
    for (const key of TARGET_KEYS) {
      const handle = targets[key];
      if (handle !== undefined) handles.push(handle);
    }
    for (const handle of handles) attachElement(handle, element);
    onCleanup(() => {
      for (const handle of handles) detachElement(handle, element);
    });
  });
}
