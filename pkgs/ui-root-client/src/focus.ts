/**
 * Moving keyboard focus without a DOM `ref`.
 *
 * A screen creates a target, hands `target` to one design-system component
 * through its `focusTarget` prop, and calls `focus()` when the keyboard
 * should go there. The element never leaves the design system.
 *
 * ```tsx
 * const search = createFocusTarget();
 * <TextInput focusTarget={search.target} value={q()} onChangeText={setQ} />
 * <Button title={t`Search`} onClick={() => search.focus()} />
 * ```
 *
 * `focus()` reads the attachment reactively: called inside `createEffect`
 * it runs again when the target mounts or moves to another component, so
 * "focus this once it exists" needs no timing code.
 */

import type { ElementHandle } from './element-handle';
import { createElementHandle } from './element-handle';

export type FocusTarget = ElementHandle<'focus'>;

export type FocusOptions = {
  /** Keep the scroll position instead of scrolling the target into view. */
  readonly preventScroll?: boolean | undefined;
};

export type FocusHandle = {
  /** Give to exactly one component's `focusTarget` prop. */
  readonly target: FocusTarget;
  /** Move focus to the target. `false` while no component holds it. */
  readonly focus: (options?: FocusOptions) => boolean;
  /** Drop focus if the target has it. */
  readonly blur: () => void;
  /** Whether a mounted component currently holds the target. Reactive. */
  readonly mounted: () => boolean;
};

export function createFocusTarget(): FocusHandle {
  const source = createElementHandle<'focus'>();
  return {
    target: source.handle,
    focus(options) {
      const element = source.element();
      if (element === undefined) return false;
      element.focus({ preventScroll: options?.preventScroll === true });
      return true;
    },
    blur() {
      source.element()?.blur();
    },
    mounted: () => source.element() !== undefined,
  };
}
