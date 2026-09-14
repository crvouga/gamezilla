/** @jsxImportSource solid-js */
/**
 * Shared tab spec for the compact bottom tab bar and the wide header island.
 */

import { NotificationsTabIcon } from '@libs/notifications/public/notifications-tab-icon';
import { Handles } from '@libs/test-ids';
import { useLingui } from '@lingui/solid/macro';
import {
  Gamepad2Icon,
  type Href,
  type IconComponent,
  SearchIcon,
  UserIcon,
} from '@pkgs/ui';
import type { Accessor } from 'solid-js';

export type AppTabName = 'Spaces' | 'Search' | 'Notifications' | 'ProfileTab';

export type AppTabSpec = {
  readonly name: AppTabName;
  readonly href: Href;
  readonly label: string;
  readonly Icon: IconComponent;
  readonly testID: string;
};

/** Paths that render inside `TabsLayout`. */
export const APP_TAB_PATHS: readonly Href[] = [
  '/',
  '/search',
  '/notifications',
  '/profile',
];

export function useAppTabs(): Accessor<readonly AppTabSpec[]> {
  const { t } = useLingui();
  return () => [
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
      Icon: NotificationsTabIcon,
      testID: Handles.tabNotifications,
    },
    {
      name: 'ProfileTab',
      href: '/profile',
      label: t`Profile`,
      Icon: UserIcon,
      testID: Handles.tabProfile,
    },
  ];
}
