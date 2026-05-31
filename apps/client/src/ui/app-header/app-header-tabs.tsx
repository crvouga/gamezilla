/**
 * Desktop header center strip: standalone tab buttons wired to the live
 * tab navigator state via {@link useTabBarProps}.
 */

import type { ReactNode } from 'react';

import { AppTabBar } from './app-tab-bar';
import { useTabBarProps } from './app-tab-bar-context';

const HEADER_LAYOUT = 'header' as const;

export function AppHeaderTabs(): ReactNode {
  const props = useTabBarProps();
  if (props === null) return null;
  return <AppTabBar {...props} layout={HEADER_LAYOUT} />;
}
