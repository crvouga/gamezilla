import { useWatchOne } from '@pkgs/sync-engine/client/sync-engine-context';
import { useEffect, type ReactNode } from 'react';

import { ProfileCol, PROFILES_TABLE } from '@libs/db/shared/profile-tables';
import { useAuthClientPort } from './auth-client-provider';
import { touchRosterAccount } from './local-account-roster';
import { useCurrentAccountId } from './use-current-account-id';
import { useLocalAccountRoster } from './use-local-account-roster';

type ProfileDisplayRow = {
  readonly username: string | null;
  readonly avatar_config: string | null;
};

function nonEmptyUsername(value: string | null | undefined): string | undefined {
  if (value === null || value === undefined || value.length === 0) {
    return undefined;
  }
  return value;
}

/**
 * Keeps the Kv account roster's username / avatar in sync with the active
 * account's local profile row (runs inside the sync-engine tree).
 */
export function AccountRosterProfileSync({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  const accountId = useCurrentAccountId();
  const port = useAuthClientPort();
  const sessions = port.useAccountSessions();
  const [, setRoster] = useLocalAccountRoster();
  const activeSession = sessions.find((session) => session.isActive);

  const { row } = useWatchOne<ProfileDisplayRow>(
    accountId === null
      ? `SELECT ${ProfileCol.username} AS username,
                ${ProfileCol.avatarConfig} AS avatar_config
         FROM ${PROFILES_TABLE.tableName} WHERE 0`
      : `SELECT ${ProfileCol.username} AS username,
                ${ProfileCol.avatarConfig} AS avatar_config
         FROM ${PROFILES_TABLE.tableName}
         WHERE ${ProfileCol.id} = ?`,
    accountId === null ? [] : [accountId]
  );

  useEffect(() => {
    if (accountId === null || activeSession === undefined) return;
    // Never bind this account's profile onto a session owned by another Clerk user.
    if (
      activeSession.externalUserId.length === 0 ||
      accountId.length === 0
    ) {
      return;
    }
    const username = nonEmptyUsername(row?.username);
    const avatarConfigJson = nonEmptyUsername(row?.avatar_config);
    setRoster((prev) =>
      touchRosterAccount({
        roster: prev,
        accountId,
        sessionId: activeSession.sessionId,
        externalUserId: activeSession.externalUserId,
        ...(username !== undefined ? { username } : {}),
        ...(avatarConfigJson !== undefined ? { avatarConfigJson } : {}),
      })
    );
  }, [accountId, activeSession, row?.username, row?.avatar_config, setRoster]);

  return children;
}
