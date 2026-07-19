import { useMemo } from 'react';

import { useAuthClientPort } from './auth-client-provider';
import type { AccountSession } from '@pkgs/auth/client/account-session';
import { useCurrentAccountId } from './use-current-account-id';
import { useLocalAccountRoster } from './use-local-account-roster';
import type { LocalAccountRosterEntry } from './local-account-roster-types';

export type LocalAccount = {
  readonly accountId: string | null;
  readonly sessionId: string;
  readonly externalUserId: string;
  readonly email: string | null;
  readonly username: string | null;
  readonly avatarConfigJson: string | null;
  readonly isActive: boolean;
  readonly lastActiveAt: string | null;
};

function mergeSessionWithRoster(
  session: AccountSession,
  rosterBySession: Map<string, LocalAccountRosterEntry>,
  activeAccountId: string | null
): LocalAccount {
  const entry = rosterBySession.get(session.sessionId);
  return {
    accountId: entry?.accountId ?? (session.isActive ? activeAccountId : null),
    sessionId: session.sessionId,
    externalUserId: session.externalUserId,
    email: session.email,
    username: entry?.username ?? null,
    avatarConfigJson: entry?.avatarConfigJson ?? null,
    isActive: session.isActive,
    lastActiveAt: entry?.lastActiveAt ?? null,
  };
}

/**
 * Local accounts available for switching: auth sessions joined with Kv roster
 * display metadata (username / avatar).
 */
export function useLocalAccounts(): readonly LocalAccount[] {
  const port = useAuthClientPort();
  const sessions = port.useAccountSessions();
  const [roster] = useLocalAccountRoster();
  const activeAccountId = useCurrentAccountId();

  return useMemo(() => {
    const rosterBySession = new Map(
      roster.map((entry) => [entry.sessionId, entry] as const)
    );
    return sessions.map((session) =>
      mergeSessionWithRoster(session, rosterBySession, activeAccountId)
    );
  }, [sessions, roster, activeAccountId]);
}
