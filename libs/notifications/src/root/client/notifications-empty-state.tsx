import { Trans } from '@lingui/react/macro';
import {
  BellIcon,
  EmptyState,
  ListChecksIcon,
  SquareStackIcon,
} from '@pkgs/ui-rn';
import type { ReactNode } from 'react';

import type { NotificationFilter } from '../../shared/notifications/notification';

export function NotificationsEmptyState({
  filter,
}: {
  readonly filter: NotificationFilter;
}): ReactNode {
  if (filter === 'archived') {
    return (
      <EmptyState
        icon={SquareStackIcon}
        title={<Trans>Nothing archived</Trans>}
        body={<Trans>Notifications you archive are kept here.</Trans>}
      />
    );
  }
  if (filter === 'action_required') {
    return (
      <EmptyState
        icon={ListChecksIcon}
        title={<Trans>Nothing needs your attention</Trans>}
        body={<Trans>Requests and invites that need a reply land here.</Trans>}
      />
    );
  }
  return (
    <EmptyState
      icon={BellIcon}
      title={<Trans>You&apos;re all caught up</Trans>}
      body={
        <Trans>
          New notifications will show up here when someone reaches out.
        </Trans>
      }
    />
  );
}
