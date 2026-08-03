import { sql } from '@pkgs/sql';

import { useWatchOne } from '@pkgs/sync-engine/client/sync-engine-context';
import { useMemo } from 'react';

import type { AccountSession } from '@pkgs/auth/client/account-session';

import { useAuthClientPort } from './auth-client-provider';
import { findRosterEntryForSession } from './local-account-roster';
import type { LocalAccountRosterEntry } from './local-account-roster-types';
import {
  mergeLocalAccountDisplay,
  type ActiveProfileDisplayRow,
} from './merge-local-account-display';
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

function resolveAccountId(
  entry: LocalAccountRosterEntry | undefined,
  isActive: boolean,
  activeAccountId: string | null
): string | null {
  if (entry?.accountId !== undefined) return entry.accountId;
  if (isActive) return activeAccountId;
  return null;
}

function accountDedupeKey(account: LocalAccount): string {
  if (account.accountId !== null) return `acct:${account.accountId}`;
  return `ext:${account.externalUserId}`;
}

/** Prefer active, then most recently touched — one row per account/user. */
function preferLocalAccount(
  current: LocalAccount,
  candidate: LocalAccount
): LocalAccount {
  if (candidate.isActive && !current.isActive) return candidate;
  if (!candidate.isActive && current.isActive) return current;
  const currentTouched = current.lastActiveAt ?? '';
  const candidateTouched = candidate.lastActiveAt ?? '';
  return candidateTouched > currentTouched ? candidate : current;
}

function dedupeLocalAccounts(
  accounts: readonly LocalAccount[]
): readonly LocalAccount[] {
  const byKey = new Map<string, LocalAccount>();
  for (const account of accounts) {
    const key = accountDedupeKey(account);
    const existing = byKey.get(key);
    byKey.set(
      key,
      existing === undefined ? account : preferLocalAccount(existing, account)
    );
  }
  return [...byKey.values()];
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
    ...mergeLocalAccountDisplay({
      session,
      entry,
      activeAccountId,
      activeProfile,
    }),
    isActive,
    lastActiveAt: entry?.lastActiveAt ?? null,
  };
}

/**
 * Local accounts available for switching: auth sessions joined with Kv roster
 * bindings + last-known display. Active-account username/avatar prefer the live
 * SQLite profile row; inactive rows use the roster display cache.
 */
export function useLocalAccounts(): readonly LocalAccount[] {
  const port = useAuthClientPort();
  const sessions = port.useAccountSessions();
  const [roster] = useLocalAccountRoster();
  const activeAccountId = useCurrentAccountId();

  const { row: activeProfile } = useWatchOne(sql<ActiveProfileDisplayRow>`
    SELECT username, avatar_config
    FROM profiles
    WHERE id = ${activeAccountId}
  `);
  // Prefer live row when present. Do not blank username while reconnecting —
  // merge falls back to session username when SQLite is still empty.
  const trustedProfile = activeProfile ?? null;

  return useMemo(() => {
    const merged = sessions.map((session) => {
      const entry = findRosterEntryForSession(roster, {
        sessionId: session.sessionId,
        externalUserId: session.externalUserId,
      });
      return mergeSessionWithRoster(
        session,
        entry,
        activeAccountId,
        trustedProfile
      );
    });
    return dedupeLocalAccounts(merged);
  }, [sessions, roster, activeAccountId, trustedProfile]);
}
