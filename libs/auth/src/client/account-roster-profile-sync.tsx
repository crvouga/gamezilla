import { sql } from '@pkgs/sql';

import { useWatchOne } from '@pkgs/sync-engine/client/sync-engine-context';
import { useEffect, type ReactNode } from 'react';

import { useAuthClientPort } from './auth-client-provider';
import { patchRosterProfileDisplay } from './local-account-roster';
import { useCurrentAccountId } from './use-current-account-id';
import { useLocalAccountRoster } from './use-local-account-roster';

type ProfileDisplayRow = {
  readonly username: string | null;
  readonly avatar_config: string | null;
};

function nonEmptyString(value: string | null | undefined): string | undefined {
  if (value === null || value === undefined || value.length === 0) {
    return undefined;
  }
  return value;
}

/**
 * Keeps the Kv account roster's username / avatar in sync with the active
 * account's local profile row (runs inside the sync-engine tree).
 *
 * Display-only: does not rebind sessionId. Auth refresh owns session↔account.
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

  const { row, isLoading: profileLoading } = useWatchOne(sql<ProfileDisplayRow>`
    SELECT username, avatar_config
    FROM profiles
    WHERE id = ${accountId}
  `);

  useEffect(() => {
    if (accountId === null || activeSession === undefined) return;
    if (activeSession.externalUserId.length === 0) return;
    if (profileLoading) return;
    const username = nonEmptyString(row?.username);
    const avatarConfigJson = nonEmptyString(row?.avatar_config);
    if (username === undefined && avatarConfigJson === undefined) return;
    const externalUserId = activeSession.externalUserId;
    setRoster((prev) =>
      patchRosterProfileDisplay({
        roster: prev,
        accountId,
        expectedExternalUserId: externalUserId,
        ...(username !== undefined ? { username } : {}),
        ...(avatarConfigJson !== undefined ? { avatarConfigJson } : {}),
      })
    );
  }, [
    accountId,
    activeSession,
    profileLoading,
    row?.username,
    row?.avatar_config,
    setRoster,
  ]);

  return children;
}
