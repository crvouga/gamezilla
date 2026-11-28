/** @jsxImportSource @solidjs/web */

import type { NotificationFilter } from '@libs/notifications-shared-ts/notification';
import { Trans } from '@pkgs/lingui-solid-client-ts/macro';
import { EmptyState } from '@pkgs/ui-root-client-ts/empty-state';
import {
  ArchiveArt,
  NotificationsArt,
} from '@pkgs/ui-root-client-ts/illustration';

import type { JSX } from '@solidjs/web';
import { Match, Switch } from 'solid-js';

export function NotificationsEmptyState(props: {
  readonly filter: NotificationFilter;
}): JSX.Element {
  return (
    <Switch>
      <Match when={props.filter === 'archived'}>
        <EmptyState
          icon={ArchiveArt}
          title={<Trans>Nothing archived</Trans>}
          body={<Trans>Notifications you archive are kept here.</Trans>}
        />
      </Match>
      <Match when={props.filter === 'action_required'}>
        <EmptyState
          icon={NotificationsArt}
          title={<Trans>Nothing needs your attention</Trans>}
          body={
            <Trans>Requests and invites that need a reply land here.</Trans>
          }
        />
      </Match>
      <Match when={true}>
        <EmptyState
          icon={NotificationsArt}
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
