/**
 * Shared tab spec for bottom tabs (compact) and the desktop header island.
 */

import { NotificationsTabIcon } from '@libs/notifications/public';
import { Handles } from '@libs/test-ids';
import { useLingui } from '@lingui/react/macro';
import {
  Gamepad2Icon,
  type Href,
  type IconComponent,
  SearchIcon,
  UserIcon,
} from '@pkgs/ui-rn';
import { useMemo } from 'react';

import type { TabsParamList } from './types';

export type AppTabSpec = {
  readonly name: keyof TabsParamList;
  readonly href: Href;
  readonly label: string;
  readonly Icon: IconComponent;
  readonly testID: string;
};

export function useAppTabs(): readonly AppTabSpec[] {
  const { t } = useLingui();
  return useMemo(
    () => [
      {
        name: 'Spaces',
        href: '/',
        label: t`Spaces`,
        Icon: Gamepad2Icon,
        testID: Handles.tabSpaces,
      },
      {
        name: 'Search',
        href: '/search',
        label: t`Search`,
        Icon: SearchIcon,
        testID: Handles.tabSearch,
      },
      {
        name: 'Notifications',
        href: '/notifications',
        label: t`Notifications`,
        Icon: NotificationsTabIcon as IconComponent,
        testID: Handles.tabNotifications,
      },
      {
        name: 'ProfileTab',
        href: '/profile',
        label: t`Profile`,
        Icon: UserIcon,
        testID: Handles.tabProfile,
      },
    ],
    [t]
  );
}

/** Whether `pathname` belongs to this tab's route tree. */
export function isAppTabActive(href: Href, pathname: string): boolean {
  if (href === '/') {
    return pathname === '/' || pathname === '';
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}
