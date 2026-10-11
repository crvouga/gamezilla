/**
 * The tab bar's spec comes from whichever subs contributed a tab, in the
 * order they declared. The shell owns no tabs of its own.
 */

import type { SubTab } from '@libs/sub-client/client';
import { type Accessor, createMemo } from 'solid-js';

import { useAppSubs } from './app-subs-context';

export type AppTabSpec = {
  readonly name: string;
  readonly href: string;
  readonly label: string;
  readonly Icon: SubTab['Icon'];
  readonly testID: string;
};

/**
 * Labels are read through the active locale, so they are evaluated inside a
 * memo owned by the calling component rather than in a bare thunk.
 */
export function useAppTabs(): Accessor<readonly AppTabSpec[]> {
  const subs = useAppSubs();
  return createMemo(() =>
    subs.tabs.map((tab) => ({
      name: tab.name,
      href: tab.href,
      label: tab.label(),
      Icon: tab.Icon,
      testID: tab.testID,
    }))
  );
}
