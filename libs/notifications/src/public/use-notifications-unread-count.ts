import { createQuery } from '@pkgs/sync-engine/solid';
import { type Accessor, createMemo } from 'solid-js';

import { useNotificationsShell } from './notifications-provider-registry';
import { inboxUnreadCountSql } from './notifications-queries';

export function useNotificationsUnreadCount(): Accessor<number> {
  const shell = useNotificationsShell();
  const { rows } = createQuery(() => inboxUnreadCountSql(shell.userId));
  return createMemo(() => {
    const raw = rows()[0]?.count ?? 0;
    return typeof raw === 'string' ? Number.parseInt(raw, 10) : Number(raw);
  });
}
