import { useQuery } from '@pkgs/sync-engine/client';
import { useMemo } from 'react';
import { useInboxShell } from './inbox-provider-registry';
import { inboxUnreadCountSql } from './inbox-queries';

export function useInboxUnreadCount(): number {
  const { userId } = useInboxShell();
  const query = useMemo(() => inboxUnreadCountSql(userId), [userId]);
  const { rows } = useQuery(query);
  const raw = rows[0]?.count ?? 0;
  return typeof raw === 'string' ? Number.parseInt(raw, 10) : Number(raw);
}
