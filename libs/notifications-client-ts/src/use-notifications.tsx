import type {
  Notification,
  NotificationFilter,
} from '@libs/notifications-shared-ts/notification';
import { inboxListSql } from '@libs/notifications-shared-ts/notifications-queries';
import {
  buildNotificationSections,
  NEEDS_YOU_SECTION_KEY,
} from '@libs/notifications-shared-ts/notifications-sections';
import { clientRowToInteraction } from '@libs/notifications-shared-ts/row-mapper';
import { useClock } from '@pkgs/clock-client-ts/solid';
import { useLingui } from '@pkgs/lingui-solid-client-ts/macro';
import { createQuery } from '@pkgs/sync-engine-client-ts/sync-engine-context';
import { type Accessor, createMemo, createSignal } from 'solid-js';
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
  const { t } = useLingui();
  // The groups' headings, in the reader's language.
  const sectionTitle = (key: string): string => {
    if (key === NEEDS_YOU_SECTION_KEY) return t`Needs you`;
    if (key === 'today') return t`Today`;
    if (key === 'yesterday') return t`Yesterday`;
    if (key === 'this_week') return t`This week`;
    return t`Earlier`;
  };
  // A filter the caller names wins each time it changes; without one the
  // person's own choice stands.
  const [filter, setFilter] = createSignal<NotificationFilter>(
    (chosen) => options?.filter ?? chosen ?? 'all'
  );
  const { rows, isLoading } = createQuery(() =>
    inboxListSql(shell.userId, filter())
  );
  const interactions = createMemo(() =>
    rows().map((row) => clientRowToInteraction({ ...row }))
  );
  const sections = createMemo(() =>
    buildNotificationSections(interactions(), clock.now, sectionTitle)
  );
  return {
    interactions,
    sections,
    isLoading,
    filter,
    setFilter,
  };
}
