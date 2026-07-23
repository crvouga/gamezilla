import { useWatchOne } from '@pkgs/sync-engine/client/sync-engine-context';
import { useMemo } from 'react';

import { ProfileCol, PROFILES_TABLE } from '@libs/db/shared/profile-tables';
import type { AccountSession } from '@pkgs/auth/client/account-session';

import { useAuthClientPort } from './auth-client-provider';
import { findRosterEntryForSession } from './local-account-roster';
import type { LocalAccountRosterEntry } from './local-account-roster-types';
import { useCurrentAccountId } from './use-current-account-id';
import { useLocalAccountRoster } from './use-local-account-roster';

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

type ActiveProfileDisplayRow = {
  readonly username: string | null;
  readonly avatar_config: string | null;
};

function nonEmpty(value: string | null | undefined): string | null {
  if (value === null || value === undefined || value.length === 0) return null;
  return value;
}

/** Title when no username is known yet — never the literal "Account". */
export function accountDisplayTitle(account: {
  readonly username: string | null;
  readonly email: string | null;
  readonly externalUserId: string;
}): string {
  const username = nonEmpty(account.username);
  if (username !== null) return username;
  const email = nonEmpty(account.email);
  if (email !== null) {
    const at = email.indexOf('@');
    if (at > 0) return email.slice(0, at);
    return email;
  }
  return account.externalUserId;
}

function resolveUsername(
  rosterUsername: string | null,
  sessionUsername: string | null,
  isActive: boolean,
  activeProfileUsername: string | null
): string | null {
  const fromRoster = nonEmpty(rosterUsername);
  if (fromRoster !== null) return fromRoster;
  if (isActive) {
    const fromProfile = nonEmpty(activeProfileUsername);
    if (fromProfile !== null) return fromProfile;
  }
  return nonEmpty(sessionUsername);
}

function resolveAvatarConfigJson(
  rosterAvatarConfigJson: string | null,
  isActive: boolean,
  activeProfileAvatarConfigJson: string | null
): string | null {
  const fromRoster = nonEmpty(rosterAvatarConfigJson);
  if (fromRoster !== null) return fromRoster;
  if (!isActive) return null;
  return nonEmpty(activeProfileAvatarConfigJson);
}

function resolveAccountId(
  entry: LocalAccountRosterEntry | undefined,
  isActive: boolean,
  activeAccountId: string | null
): string | null {
  if (entry?.accountId !== undefined) return entry.accountId;
  if (isActive) return activeAccountId;
  return null;
}

function mergeDisplayFields(
  session: AccountSession,
  entry: LocalAccountRosterEntry | undefined,
  activeProfile: ActiveProfileDisplayRow | null
): Pick<LocalAccount, 'username' | 'avatarConfigJson'> {
  const isActive = session.isActive;
  return {
    username: resolveUsername(
      entry?.username ?? null,
      session.username,
      isActive,
      activeProfile?.username ?? null
    ),
    avatarConfigJson: resolveAvatarConfigJson(
      entry?.avatarConfigJson ?? null,
      isActive,
      activeProfile?.avatar_config ?? null
    ),
  };
}

function mergeSessionWithRoster(
  session: AccountSession,
  entry: LocalAccountRosterEntry | undefined,
  activeAccountId: string | null,
  activeProfile: ActiveProfileDisplayRow | null
): LocalAccount {
  const isActive = session.isActive;
  return {
    accountId: resolveAccountId(entry, isActive, activeAccountId),
    sessionId: session.sessionId,
    externalUserId: session.externalUserId,
    email: session.email,
    ...mergeDisplayFields(session, entry, activeProfile),
    isActive,
    lastActiveAt: entry?.lastActiveAt ?? null,
  };
}

/**
 * Local accounts available for switching: auth sessions joined with Kv roster
 * display metadata (username / avatar). Active account falls back to the live
 * profile when the roster has not caught up yet; otherwise provider username
 * (Clerk) is used for the title.
 */
export function useLocalAccounts(): readonly LocalAccount[] {
  const port = useAuthClientPort();
  const sessions = port.useAccountSessions();
  const [roster] = useLocalAccountRoster();
  const activeAccountId = useCurrentAccountId();

  const { row: activeProfile } = useWatchOne<ActiveProfileDisplayRow>(
    activeAccountId === null
      ? `SELECT ${ProfileCol.username} AS username,
                ${ProfileCol.avatarConfig} AS avatar_config
         FROM ${PROFILES_TABLE.tableName} WHERE 0`
      : `SELECT ${ProfileCol.username} AS username,
                ${ProfileCol.avatarConfig} AS avatar_config
         FROM ${PROFILES_TABLE.tableName}
         WHERE ${ProfileCol.id} = ?`,
    activeAccountId === null ? [] : [activeAccountId]
  );

  return useMemo(() => {
    return sessions.map((session) => {
      const entry = findRosterEntryForSession(roster, {
        sessionId: session.sessionId,
        externalUserId: session.externalUserId,
      });
      return mergeSessionWithRoster(
        session,
        entry,
        activeAccountId,
        activeProfile ?? null
      );
    });
  }, [sessions, roster, activeAccountId, activeProfile]);
}
