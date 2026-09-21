/**
 * The tab bar's spec comes from whichever features contributed a tab, in the
 * order they declared. The shell owns no tabs of its own.
 */

import type { FeatureTab } from '@libs/feature/public/client';
import { type Accessor, createMemo } from 'solid-js';

import { useAppFeatures } from '../shell/app-features-context';

export type AppTabSpec = {
  readonly name: string;
  readonly href: string;
  readonly label: string;
  readonly Icon: FeatureTab['Icon'];
  readonly testID: string;
};

/**
 * Labels are read through the active locale, so they are evaluated inside a
 * memo owned by the calling component rather than in a bare thunk.
 */
export function useAppTabs(): Accessor<readonly AppTabSpec[]> {
  const features = useAppFeatures();
  return createMemo(() =>
    features.tabs.map((tab) => ({
      name: tab.name,
      href: tab.href,
      label: tab.label(),
      Icon: tab.Icon,
      testID: tab.testID,
    }))
  );
}
