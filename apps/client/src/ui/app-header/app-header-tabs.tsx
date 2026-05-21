/**
 * Centered tab strip rendered inside the screen header on desktop. Mounted
 * by the top-level tab screens (Spaces / Profile) via {@link ScreenBaseHeader}
 * `centerTabs` so we never stack two top bars.
 */

import { Box, type IconSymbolName } from '@gamezilla/ui';
import { useLingui } from '@lingui/react/macro';
import { usePathname } from 'expo-router';
import type { ReactNode } from 'react';

import { AppTabButton } from './app-tab-button';

type AppTabSpec = {
  href: '/' | '/profile';
  label: string;
  icon: IconSymbolName;
};

function useAppTabs(): readonly AppTabSpec[] {
  const { t } = useLingui();
  return [
    { href: '/', label: t`Spaces`, icon: 'house.fill' },
    { href: '/profile', label: t`Profile`, icon: 'person.fill' },
  ];
}

function normalizePathname(pathname: string): string {
  const stripped = pathname.split('?')[0]?.replace(/\/$/, '') ?? '';
  return stripped === '' ? '/' : stripped;
}

function isTabActive(tab: AppTabSpec, normalized: string): boolean {
  if (tab.href === '/') return normalized === '/';
  return normalized === tab.href || normalized.startsWith(`${tab.href}/`);
}

export function AppHeaderTabs(): ReactNode {
  const tabs = useAppTabs();
  const pathname = usePathname();
  const normalized = normalizePathname(pathname);
  return (
    <Box sx={{ flexDirection: 'row', alignItems: 'stretch', gap: 1 }}>
      {tabs.map((tab) => (
        <AppTabButton
          key={tab.href}
          href={tab.href}
          label={tab.label}
          icon={tab.icon}
          active={isTabActive(tab, normalized)}
        />
      ))}
    </Box>
  );
}
