/** @jsxImportSource solid-js */

import { isAppTabActive } from '@libs/app-root-shared-ts/is-app-tab-active';
import { brandMarkSource } from '@libs/product-identity-shared-ts/brand-mark';
import { PRODUCT_NAME } from '@libs/product-identity-shared-ts/product-identity';
import { AppHeaderIsland } from '@pkgs/ui-root-client-ts/app-header-island';
import type { AppHeaderIslandItem } from '@pkgs/ui-root-client-ts/app-header-island-types';
import { AppLogo } from '@pkgs/ui-root-client-ts/app-logo';
import type { JSX } from 'solid-js';
import type { AppTabSpec } from './app-tabs';

const LOGO_SIZE = 24;

export type AppHeaderIslandViewProps = {
  /** The composed subs' tabs, in their declared order. */
  readonly tabs: readonly AppTabSpec[];
  /** The current route; its tab's pill is the current page. */
  readonly pathname: string;
  readonly onSelect: (tab: AppTabSpec) => void;
  /** The global actions (the account menu); defaults to the frame's own. */
  readonly trailing?: JSX.Element;
  /** `vertical` is the wide sidebar; the default is the top row. */
  readonly orientation?: 'horizontal' | 'vertical' | undefined;
};

/**
 * Wide navigation, presentational: logo, the tabs and the global actions —
 * the top row, or (`vertical`) the sidebar mounted via `AppFrame` `rail`.
 * Compact layouts use the tab bar instead.
 * `AppHeaderIslandHost` supplies the tabs, route and account menu.
 */
export function AppHeaderIslandView(
  props: AppHeaderIslandViewProps
): JSX.Element {
  const items = (): AppHeaderIslandItem[] =>
    props.tabs.map((tab) => ({
      id: tab.name,
      label: tab.label,
      icon: tab.Icon,
      active: isAppTabActive(tab.href, props.pathname, tab.alsoActiveUnder),
      onClick: () => props.onSelect(tab),
      dataSet: { testid: tab.testID },
    }));

  return (
    <AppHeaderIsland
      leading={
        <AppLogo
          name={PRODUCT_NAME}
          markSrc={brandMarkSource()}
          size={LOGO_SIZE}
        />
      }
      items={items()}
      trailing={props.trailing}
      orientation={props.orientation}
    />
  );
}
