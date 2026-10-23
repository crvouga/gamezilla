/** @jsxImportSource solid-js */
/**
 * Compact bottom tab bar: the design-system `TabBar` over whichever tabs the
 * composed subs contributed, in their declared order. Each tab is a button
 * that hands its spec to `onSelect`; the one matching `pathname` is the
 * current page.
 */

import { isAppTabActive } from '@libs/app-root-shared-ts/is-app-tab-active';
import { useLingui } from '@lingui/solid/macro';
import { TabBar, type TabBarItem } from '@pkgs/ui-root-client-ts/tab-bar';
import { createMemo, type JSX } from 'solid-js';
import type { AppTabSpec } from './app-tabs';
import { useAppTabs } from './app-tabs';

export type AppTabBarProps = {
  readonly pathname: string;
  readonly onSelect: (tab: AppTabSpec) => void;
};

export function AppTabBar(props: AppTabBarProps): JSX.Element {
  const { t } = useLingui();
  const tabs = useAppTabs();
  // `current` is a getter so a route change updates the items in place
  // instead of rebuilding them (and dropping keyboard focus).
  const items = createMemo((): TabBarItem[] =>
    tabs().map((tab) => ({
      id: tab.name,
      label: tab.label,
      icon: tab.Icon,
      get current() {
        return isAppTabActive(tab.href, props.pathname);
      },
      onPress: () => props.onSelect(tab),
      dataSet: { component: 'AppTabButton', testid: tab.testID },
    }))
  );
  return (
    <TabBar
      aria-label={t`Navigation`}
      items={items()}
      dataSet={{ component: 'AppTabBar' }}
    />
  );
}
