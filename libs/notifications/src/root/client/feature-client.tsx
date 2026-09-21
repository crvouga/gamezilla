/** @jsxImportSource solid-js */
/**
 * What notifications contributes to a client app: the inbox screen and tab,
 * the unread-count root the header badge reads above the SQLite gate, and the
 * registry that serves whatever sources other features registered.
 */

import { defineFeatureClient } from '@libs/feature/public/client';
import { NotificationsTabIcon } from '@libs/notifications/public/notifications-tab-icon';
import { NotificationsUnreadCountRoot } from '@libs/notifications/public/notifications-unread-count-chrome';
import { Handles } from '@libs/test-ids';
import { useLingui } from '@lingui/solid/macro';

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
      load: () => import('./routes/notifications'),
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
  session: () => import('./app/session-provider'),
});
