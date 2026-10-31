/** @jsxImportSource solid-js */
/**
 * Wide header island composition: logo | tab pills | global menu. Mounted via
 * `AppFrame` `header`; ignored on compact layouts.
 */

import { isAppTabActive } from '@libs/app-root-shared-ts/is-app-tab-active';
import { PRODUCT_NAME } from '@libs/product-identity-shared-ts/product-identity';
import { useAppFrameGlobalTrailing } from '@pkgs/ui-root-client-ts/app-frame-chrome';
import { AppHeaderIsland } from '@pkgs/ui-root-client-ts/app-header-island';
import type { AppHeaderIslandItem } from '@pkgs/ui-root-client-ts/app-header-island-types';
import { AppLogo } from '@pkgs/ui-root-client-ts/app-logo';
import { usePathname, useRouter } from '@pkgs/ui-root-client-ts/app-router';
import type { JSX } from 'solid-js';
import { useAppTabs } from './app-tabs';

const LOGO_SIZE = 24;

export function AppHeaderIslandHost(): JSX.Element {
  const router = useRouter();
  const pathname = usePathname();
  const tabs = useAppTabs();
  const trailing = useAppFrameGlobalTrailing();
  const items = (): AppHeaderIslandItem[] =>
    tabs().map((tab) => ({
      id: tab.name,
      label: tab.label,
      icon: tab.Icon,
      active: isAppTabActive(tab.href, pathname()),
      onClick: () => router.push(tab.href),
      dataSet: { testid: tab.testID },
    }));

  return (
    <AppHeaderIsland
      leading={<AppLogo name={PRODUCT_NAME.toLowerCase()} size={LOGO_SIZE} />}
      items={items()}
      trailing={trailing()}
    />
  );
}
