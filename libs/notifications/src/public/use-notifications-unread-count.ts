import { createQuery } from '@pkgs/sync-engine/solid';
import { type Accessor, createMemo } from 'solid-js';

import { useNotificationsShell } from './notifications-provider-registry';
import { inboxUnreadCountSql } from './notifications-queries';

export function useNotificationsUnreadCount(): Accessor<number> {
  const shell = useNotificationsShell();
  const { rows } = createQuery(() =>
    inboxUnreadCountSql(shell.isSignedIn ? shell.userId : '')
  );
  return createMemo(() => {
    if (!shell.isSignedIn || shell.userId.length === 0) return 0;
    const raw = rows()[0]?.count ?? 0;
    const n = typeof raw === 'string' ? Number.parseInt(raw, 10) : Number(raw);
    return Number.isFinite(n) ? n : 0;
  });
}
