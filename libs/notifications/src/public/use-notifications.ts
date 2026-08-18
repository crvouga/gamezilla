import { useIo } from '@pkgs/io';
import { useQuery } from '@pkgs/sync-engine/client';
import { useEffect, useMemo, useState } from 'react';
import type {
  Notification,
  NotificationFilter,
} from '../shared/notifications/notification';
import { clientRowToInteraction } from '../shared/notifications/row-mapper';
import { useNotificationsShell } from './notifications-provider-registry';
import { inboxListSql } from './notifications-queries';
import { buildNotificationSections } from './notifications-sections';

export function useNotifications(options?: {
  readonly filter?: NotificationFilter;
}): {
  readonly interactions: readonly Notification[];
  readonly sections: ReturnType<typeof buildNotificationSections>;
  readonly isLoading: boolean;
  readonly filter: NotificationFilter;
  readonly setFilter: (filter: NotificationFilter) => void;
} {
  const { userId } = useNotificationsShell();
  const io = useIo();
  const [filter, setFilter] = useState<NotificationFilter>(
    options?.filter ?? 'all'
  );

  useEffect(() => {
    if (options?.filter !== undefined) {
      setFilter(options.filter);
    }
  }, [options?.filter]);
  const query = useMemo(() => inboxListSql(userId, filter), [userId, filter]);
  const { rows, isLoading } = useQuery(query);
  const interactions = useMemo(
    () => rows.map((row) => clientRowToInteraction({ ...row })),
    [rows]
  );
  const sections = useMemo(
    () => buildNotificationSections(interactions, io.clock.now),
    [interactions, io.clock.now]
  );
  return { interactions, sections, isLoading, filter, setFilter };
}
