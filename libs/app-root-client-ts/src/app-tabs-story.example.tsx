/**
 * Story-only tab specs: the four tabs the full product composes, with their
 * shipped hrefs, icons and test ids, so shell chrome stories match the app.
 */

import { SearchIcon } from '@pkgs/ui-root-client-ts/icons';
import {
  NotificationsArt,
  ProfileArt,
  SpacesArt,
} from '@pkgs/ui-root-client-ts/illustration';
import type { AppTabSpec } from './app-tabs';

export const STORY_APP_TABS: readonly AppTabSpec[] = [
  {
    name: 'Spaces',
    href: '/',
    label: 'Spaces',
    Icon: SpacesArt,
    testID: 'tab-spaces',
    alsoActiveUnder: ['/space'],
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
    Icon: NotificationsArt,
    testID: 'tab-notifications',
  },
  {
    name: 'ProfileTab',
    href: '/profile',
    label: 'Profile',
    Icon: ProfileArt,
    testID: 'tab-profile',
    alsoActiveUnder: ['/more'],
  },
];

/** The same tabs with labels as long as a verbose locale might make them. */
export const STORY_LONG_APP_TABS: readonly AppTabSpec[] = STORY_APP_TABS.map(
  (tab) => ({ ...tab, label: `${tab.label} and everything else` })
);
