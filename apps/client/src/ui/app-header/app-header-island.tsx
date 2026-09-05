/**
 * Desktop header island composition: logo | tab pills | avatar menu.
 * Mounted via {@link AppFrame} `header`; ignored on compact.
 */

import {
  AppHeaderIsland,
  type AppHeaderIslandItem,
  AppLogo,
  useAppFrameGlobalTrailing,
  usePathname,
  useRouter,
} from '@pkgs/ui';
import { type ReactNode, useMemo } from 'react';

import { isAppTabActive, useAppTabs } from '../../navigation/app-tabs';

export function AppHeaderIslandHost(): ReactNode {
  const router = useRouter();
  const pathname = usePathname();
  const tabs = useAppTabs();
  const trailing = useAppFrameGlobalTrailing();
  const items = useMemo((): AppHeaderIslandItem[] => {
    return tabs.map((tab) => ({
      id: tab.name,
      label: tab.label,
      icon: tab.Icon,
      active: isAppTabActive(tab.href, pathname),
      onPress: () => router.push(tab.href),
      testID: tab.testID,
    }));
  }, [tabs, pathname, router]);

  return (
    <AppHeaderIsland
      leading={<AppLogo size={24} />}
      items={items}
      trailing={trailing}
    />
  );
}
