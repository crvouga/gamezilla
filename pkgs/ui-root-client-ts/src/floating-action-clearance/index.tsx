/** @jsxImportSource solid-js */

import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import { cssPx } from '@pkgs/ui-root-shared-ts/css-px';
import { controlSize } from '@pkgs/ui-root-shared-ts/sizes';
import {
  type Accessor,
  createContext,
  type JSX,
  Show,
  useContext,
} from 'solid-js';

/** The FAB's inset from the body's bottom-end corner (px), above any bar. */
export const FLOATING_ACTION_MARGIN = 16;

/** Room between the last row and the FAB's top edge (px). */
const FLOATING_ACTION_GAP = 16;

/**
 * Bottom room a scrolling body keeps free under a floating action button
 * `extraBottomInset` px above its usual place: its margin, its height and a
 * gap, so the last row scrolls fully clear of it.
 */
export function floatingActionClearance(extraBottomInset: number): number {
  return (
    FLOATING_ACTION_MARGIN +
    extraBottomInset +
    controlSize.lg +
    FLOATING_ACTION_GAP
  );
}

const FloatingActionClearanceContext = createContext<Accessor<number>>(() => 0);

/**
 * Tells every screen-body scroller below it how much bottom room a floating
 * action button covers (`0` while none floats). `ScreenBase` provides it;
 * screens never do.
 */
export function FloatingActionClearanceProvider(props: {
  readonly clearance: number;
  readonly children: JSX.Element;
}): JSX.Element {
  const clearance = (): number => props.clearance;
  return (
    <FloatingActionClearanceContext.Provider value={clearance}>
      {props.children}
    </FloatingActionClearanceContext.Provider>
  );
}

/** Bottom room (px) the screen's floating action button covers, or `0`. */
export function useFloatingActionClearance(): Accessor<number> {
  return useContext(FloatingActionClearanceContext);
}

/**
 * `FloatingActionClearance` -- the empty room at the end of a screen-body
 * scroller that keeps its last row out from under the screen's floating
 * action button. Renders nothing while no button floats. The screen-body
 * scrollers (`ScreenBodyScrollView`, `ScreenBodyVirtualList`, a whole-body
 * scroll) end with it, so every screen with a FAB gets it without asking.
 */
export function FloatingActionClearance(): JSX.Element {
  const clearance = useFloatingActionClearance();
  return (
    <Show when={clearance() > 0}>
      <div
        class="box shrink-0"
        aria-hidden="true"
        {...dataAttrs({ component: 'FloatingActionClearance' })}
        style={{ height: cssPx(clearance()) }}
      />
    </Show>
  );
}
