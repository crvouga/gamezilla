/** @jsxImportSource solid-js */
/**
 * Wide header island composition: logo | tab pills | global menu. Mounted via
 * `AppFrame` `header`; ignored on compact layouts.
 */

import {
  AppHeaderIsland,
  type AppHeaderIslandItem,
  AppLogo,
  useAppFrameGlobalTrailing,
  usePathname,
  useRouter,
} from '@pkgs/ui';
import type { JSX } from 'solid-js';

import { useAppTabs } from '../routes/app-tabs';
import { isAppTabActive } from '../routes/is-app-tab-active';

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
      leading={<AppLogo size={LOGO_SIZE} />}
      items={items()}
      trailing={trailing()}
    />
  );
}
