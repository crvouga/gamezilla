import { useQuery } from '@pkgs/sync-engine/client';
import { useMemo } from 'react';
import { useNotificationsShell } from './notifications-provider-registry';
import { inboxUnreadCountSql } from './notifications-queries';

export function useNotificationsUnreadCount(): number {
  const { userId } = useNotificationsShell();
  const query = useMemo(() => inboxUnreadCountSql(userId), [userId]);
  const { rows } = useQuery(query);
  const raw = rows[0]?.count ?? 0;
  return typeof raw === 'string' ? Number.parseInt(raw, 10) : Number(raw);
}
