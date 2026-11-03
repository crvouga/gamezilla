/** @jsxImportSource solid-js */
/**
 * Compact bottom tab bar over whichever tabs the composed subs contributed,
 * in their declared order. Each tab hands its spec to `onSelect`; the one
 * matching `pathname` is the current page.
 */

import type { JSX } from 'solid-js';
import { AppTabBarView } from './app-tab-bar-view';
import type { AppTabSpec } from './app-tabs';
import { useAppTabs } from './app-tabs';

export type AppTabBarProps = {
  readonly pathname: string;
  readonly onSelect: (tab: AppTabSpec) => void;
};

/** Wires `AppTabBarView` to the composed subs' tabs. */
export function AppTabBar(props: AppTabBarProps): JSX.Element {
  const tabs = useAppTabs();
  return (
    <AppTabBarView
      tabs={tabs()}
      pathname={props.pathname}
      onSelect={props.onSelect}
    />
  );
}
