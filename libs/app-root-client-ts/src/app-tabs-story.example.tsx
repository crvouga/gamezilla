/**
 * Story-only tab specs: the four tabs the full product composes, with their
 * shipped hrefs, icons and test ids, so shell chrome stories match the app.
 */

import {
  BellIcon,
  Gamepad2Icon,
  SearchIcon,
  UserIcon,
} from '@pkgs/ui-root-client-ts/icons';
import type { AppTabSpec } from './app-tabs';

export const STORY_APP_TABS: readonly AppTabSpec[] = [
  {
    name: 'Spaces',
    href: '/',
    label: 'Spaces',
    Icon: Gamepad2Icon,
    testID: 'tab-spaces',
  },
  {
    name: 'Search',
    href: '/search',
    label: 'Search',
    Icon: SearchIcon,
    testID: 'tab-search',
  },
  {
    name: 'Notifications',
    href: '/notifications',
    label: 'Notifications',
    Icon: BellIcon,
    testID: 'tab-notifications',
  },
  {
    name: 'ProfileTab',
    href: '/profile',
    label: 'Profile',
    Icon: UserIcon,
    testID: 'tab-profile',
    alsoActiveUnder: ['/more'],
  },
];

/** The same tabs with labels as long as a verbose locale might make them. */
export const STORY_LONG_APP_TABS: readonly AppTabSpec[] = STORY_APP_TABS.map(
  (tab) => ({ ...tab, label: `${tab.label} and everything else` })
);
