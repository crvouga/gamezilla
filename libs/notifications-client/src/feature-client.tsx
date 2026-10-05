import NotificationsScreen from './notifications';
import { AppNotificationsProvider } from './notifications-provider';
/** @jsxImportSource solid-js */
/**
 * What notifications contributes to a client app: the inbox screen and tab,
 * the unread-count root the header badge reads above the SQLite gate, and the
 * registry that serves whatever sources other features registered.
 */

import { defineFeatureClient } from '@libs/feature-client/client';
import { Handles } from '@libs/test-ids-shared/handles';
import { useLingui } from '@lingui/solid/macro';
import { NotificationsTabIcon } from './notifications-tab-icon';
import { NotificationsUnreadCountRoot } from './notifications-unread-count-chrome';

/** Read inside the tab memo, so the label follows the active locale. */
function notificationsTabLabel(): string {
  const { t } = useLingui();
  return t`Notifications`;
}

export const NOTIFICATIONS_CLIENT = defineFeatureClient({
  name: 'notifications',
  routes: [
    {
      path: '/notifications',
      tab: true,
      component: NotificationsScreen,
    },
  ],
  tabs: [
    {
      name: 'Notifications',
      href: '/notifications',
      order: 2,
      label: notificationsTabLabel,
      Icon: NotificationsTabIcon,
      testID: Handles.tabNotifications,
    },
  ],
  chrome: NotificationsUnreadCountRoot,
  session: AppNotificationsProvider,
});
