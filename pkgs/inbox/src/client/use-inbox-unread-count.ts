import { useWatchQuery } from '@pkgs/sync-engine/client/sync-engine-context';
import { useMemo } from 'react';

import { inboxUnreadCountSql } from './inbox-queries';
import { useInboxShell } from './inbox-provider-registry';

export function useInboxUnreadCount(): number {
  const { userId } = useInboxShell();
  const query = useMemo(() => inboxUnreadCountSql(userId), [userId]);
  const { rows } = useWatchQuery(query);
  const raw = rows[0]?.count ?? 0;
  return typeof raw === 'string' ? Number.parseInt(raw, 10) : Number(raw);
}
