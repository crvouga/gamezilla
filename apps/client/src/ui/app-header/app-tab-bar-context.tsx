/**
 * Live store of the tab navigator's current {@link BottomTabBarProps}.
 *
 * The navigator publishes its props once per render via
 * {@link AppTabBarBridge}, and the desktop screen header consumes them via
 * {@link useTabBarProps} so it can re-host the same `BottomTabBar` that
 * mobile shows at the bottom -- guaranteeing the two surfaces stay in
 * lockstep (active tab, badges, screen options) without a parallel
 * implementation.
 */

import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSyncExternalStore } from 'react';

let snapshot: BottomTabBarProps | null = null;
const listeners = new Set<() => void>();

/**
 * Publish the latest props. Skips notifying subscribers when the
 * navigation `state` object is the same reference -- `Tabs` re-emits a
 * fresh `descriptors` map on every render of its parent, and waking the
 * header on those no-ops would force an extra render per parent update.
 */
export function publishTabBarProps(next: BottomTabBarProps): void {
  if (snapshot !== null && snapshot.state === next.state) {
    snapshot = next;
    return;
  }
  snapshot = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): BottomTabBarProps | null {
  return snapshot;
}

export function useTabBarProps(): BottomTabBarProps | null {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
