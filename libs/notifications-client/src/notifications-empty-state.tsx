/** @jsxImportSource solid-js */
import { Trans } from '@lingui/solid/macro';
import { BellIcon, ListChecksIcon, SquareStackIcon } from '@pkgs/ui-client/icons';
import { EmptyState } from '@pkgs/ui-client/empty-state';
import { type JSX, Match, Switch } from 'solid-js';

import type { NotificationFilter } from '@libs/notifications-shared/notification';

export function NotificationsEmptyState(props: {
  readonly filter: NotificationFilter;
}): JSX.Element {
  return (
    <Switch>
      <Match when={props.filter === 'archived'}>
        <EmptyState
          icon={SquareStackIcon}
          title={<Trans>Nothing archived</Trans>}
          body={<Trans>Notifications you archive are kept here.</Trans>}
        />
      </Match>
      <Match when={props.filter === 'action_required'}>
        <EmptyState
          icon={ListChecksIcon}
          title={<Trans>Nothing needs your attention</Trans>}
          body={
            <Trans>Requests and invites that need a reply land here.</Trans>
          }
        />
      </Match>
      <Match when={true}>
        <EmptyState
          icon={BellIcon}
          title={<Trans>You're all caught up</Trans>}
          body={
            <Trans>
              New notifications will show up here when someone reaches out.
            </Trans>
          }
        />
      </Match>
    </Switch>
  );
}
