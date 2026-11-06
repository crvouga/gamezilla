/** @jsxImportSource solid-js */

import { isAppTabActive } from '@libs/app-root-shared-ts/is-app-tab-active';
import { useLingui } from '@lingui/solid/macro';
import { TabBar, type TabBarItem } from '@pkgs/ui-root-client-ts/tab-bar';
import { createMemo, type JSX } from 'solid-js';
import type { AppTabSpec } from './app-tabs';

export type AppTabBarViewProps = {
  /** The composed subs' tabs, in their declared order. */
  readonly tabs: readonly AppTabSpec[];
  /** The current route; the tab it belongs to is the current page. */
  readonly pathname: string;
  readonly onSelect: (tab: AppTabSpec) => void;
};

/**
 * Compact bottom tab bar, presentational: the design-system `TabBar` over the
 * given tabs. Each tab is a button handing its spec to `onSelect`; the one
 * matching `pathname` is the current page. `AppTabBar` supplies the tabs.
 */
export function AppTabBarView(props: AppTabBarViewProps): JSX.Element {
  const { t } = useLingui();
  // `current` is a getter so a route change updates the items in place
  // instead of rebuilding them (and dropping keyboard focus).
  const items = createMemo((): TabBarItem[] =>
    props.tabs.map((tab) => ({
      id: tab.name,
      label: tab.label,
      icon: tab.Icon,
      get current() {
        return isAppTabActive(tab.href, props.pathname, tab.alsoActiveUnder);
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
