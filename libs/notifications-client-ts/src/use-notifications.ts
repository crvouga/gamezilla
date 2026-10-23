import type {
  Notification,
  NotificationFilter,
} from '@libs/notifications-shared-ts/notification';
import { inboxListSql } from '@libs/notifications-shared-ts/notifications-queries';
import { buildNotificationSections } from '@libs/notifications-shared-ts/notifications-sections';
import { clientRowToInteraction } from '@libs/notifications-shared-ts/row-mapper';
import { useClock } from '@pkgs/clock-client-ts/solid';
import { createQuery } from '@pkgs/sync-engine-client-ts/sync-engine-context';
import {
  type Accessor,
  createEffect,
  createMemo,
  createSignal,
} from 'solid-js';
import { useNotificationsShell } from './notifications-provider-registry';

export function useNotifications(options?: {
  readonly filter?: NotificationFilter | undefined;
}): {
  readonly interactions: Accessor<readonly Notification[]>;
  readonly sections: Accessor<ReturnType<typeof buildNotificationSections>>;
  readonly isLoading: Accessor<boolean>;
  readonly filter: Accessor<NotificationFilter>;
  readonly setFilter: (filter: NotificationFilter) => void;
} {
  const shell = useNotificationsShell();
  const clock = useClock();
  const [filter, setFilter] = createSignal<NotificationFilter>(
    options?.filter ?? 'all'
  );

  createEffect(() => {
    const external = options?.filter;
    if (external !== undefined) {
      setFilter(external);
    }
  });
  const { rows, isLoading } = createQuery(() =>
    inboxListSql(shell.userId, filter())
  );
  const interactions = createMemo(() =>
    rows().map((row) => clientRowToInteraction({ ...row }))
  );
  const sections = createMemo(() =>
    buildNotificationSections(interactions(), clock.now)
  );
  return {
    interactions,
    sections,
    isLoading,
    filter,
    setFilter,
  };
}
