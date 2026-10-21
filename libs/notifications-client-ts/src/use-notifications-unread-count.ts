import { inboxUnreadCountSql } from '@libs/notifications-shared-ts/notifications-queries';
import { useCan } from '@libs/permissions-client-ts/use-can';
import { PERMISSION } from '@libs/permissions-shared-ts/permission-catalog';
import { createQuery } from '@pkgs/sync-engine-client-ts/sync-engine-context';
import { type Accessor, createMemo } from 'solid-js';
import { useNotificationsShell } from './notifications-provider-registry';

export function useNotificationsUnreadCount(): Accessor<number> {
  const shell = useNotificationsShell();
  const canReceive = useCan(PERMISSION.notificationsReceive);
  const { rows } = createQuery(() =>
    inboxUnreadCountSql(canReceive() ? shell.userId : '')
  );
  return createMemo(() => {
    if (!canReceive() || shell.userId.length === 0) return 0;
    const raw = rows()[0]?.count ?? 0;
    const n = typeof raw === 'string' ? Number.parseInt(raw, 10) : Number(raw);
    return Number.isFinite(n) ? n : 0;
  });
}
