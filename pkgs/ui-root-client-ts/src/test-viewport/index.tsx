/** @jsxImportSource solid-js */

import type { VirtualListViewport } from '@pkgs/ui-root-shared-ts/virtual-list-types';
import { createContext, type JSX, untrack, useContext } from 'solid-js';

/**
 * Fixed scroller rect for layout-less hosts (happy-dom unit tests, static
 * snapshots). `VirtualList` uses this when its own `fixedViewport` prop is
 * unset; real browsers never mount this provider, so production measurement
 * is untouched.
 */
const TestViewportContext = createContext<VirtualListViewport | null>(null);

export function TestViewportProvider(props: {
  readonly value: VirtualListViewport;
  readonly children: JSX.Element;
}): JSX.Element {
  // Value is a static object, never updated after mount, so reading the
  // prop once at creation time is correct (not a reactive solid signal).
  const val = untrack(() => props.value);
  return (
    <TestViewportContext.Provider value={val}>
      {props.children}
    </TestViewportContext.Provider>
  );
}

/** Fixed viewport from the nearest provider, or `null` outside tests. */
export function useTestViewport(): VirtualListViewport | null {
  return useContext(TestViewportContext);
}
