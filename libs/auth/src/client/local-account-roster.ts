import { asKeyword } from '@pkgs/keyword/keyword';
import { jsonKvCodec } from '@pkgs/kv/kv-state-codec';

import type {
  LocalAccountRoster,
  LocalAccountRosterEntry,
} from './local-account-roster-types';

export const LOCAL_ACCOUNT_ROSTER_KEY = asKeyword('auth.roster/accounts');
const LOCAL_ACCOUNT_ROSTER_VALUE_ATTR = asKeyword('auth.roster/value');

function isNullableString(value: unknown): boolean {
  return value === null || typeof value === 'string';
}

function isRosterEntry(value: unknown): value is LocalAccountRosterEntry {
  if (typeof value === 'object' && value !== null) {
    const row = value as Record<string, unknown>;
    const externalOk =
      row['externalUserId'] === undefined ||
      isNullableString(row['externalUserId']);
    return (
      typeof row['accountId'] === 'string' &&
      typeof row['sessionId'] === 'string' &&
      externalOk &&
      isNullableString(row['username']) &&
      isNullableString(row['avatarConfigJson']) &&
      typeof row['lastActiveAt'] === 'string'
    );
  }
  return false;
}

function isRoster(value: unknown): value is LocalAccountRoster {
  return Array.isArray(value) && value.every(isRosterEntry);
}

export const localAccountRosterCodec = jsonKvCodec(
  LOCAL_ACCOUNT_ROSTER_VALUE_ATTR,
  isRoster
);

/** Session id placeholder so a detached row stays findable by externalUserId. */
export function detachedRosterSessionId(accountId: string): string {
  return `detached:${accountId}`;
}

/**
 * Upsert by account id. If another account still holds this session id (stale
 * binding after a switch/refresh race), detach that row instead of deleting it
 * — deleting collapsed two switcher rows onto one username/avatar.
 */
export function upsertRosterEntry(
  roster: LocalAccountRoster,
  entry: LocalAccountRosterEntry
): LocalAccountRoster {
  const next: LocalAccountRosterEntry[] = [];
  for (const row of roster) {
    if (row.accountId === entry.accountId) {
      continue;
    }
    if (row.sessionId === entry.sessionId) {
      next.push({
        ...row,
        sessionId: detachedRosterSessionId(row.accountId),
      });
      continue;
    }
    next.push(row);
  }
  return [entry, ...next];
}

export function removeRosterAccount(
  roster: LocalAccountRoster,
  accountId: string
): LocalAccountRoster {
  return roster.filter((row) => row.accountId !== accountId);
}

export function removeRosterSession(
  roster: LocalAccountRoster,
  sessionId: string
): LocalAccountRoster {
  return roster.filter((row) => row.sessionId !== sessionId);
}

export function trimRosterToSessions(
  roster: LocalAccountRoster,
  sessionIds: ReadonlySet<string>
): LocalAccountRoster {
  return roster.filter((row) => sessionIds.has(row.sessionId));
}

function sessionBindingMatchesExternalUser(
  entry: LocalAccountRosterEntry,
  externalUserId: string
): boolean {
  return (
    entry.externalUserId === null || entry.externalUserId === externalUserId
  );
}

export function findRosterEntryForSession(
  roster: LocalAccountRoster,
  args: {
    readonly sessionId: string;
    readonly externalUserId: string;
  }
): LocalAccountRosterEntry | undefined {
  const bySession = roster.find((row) => row.sessionId === args.sessionId);
  if (
    bySession !== undefined &&
    sessionBindingMatchesExternalUser(bySession, args.externalUserId)
  ) {
    return bySession;
  }
  return roster.find((row) => row.externalUserId === args.externalUserId);
}

function coalesceRosterField(
  next: string | null | undefined,
  existing: string | null | undefined
): string | null {
  return next ?? existing ?? null;
}

export function touchRosterAccount(args: {
  readonly roster: LocalAccountRoster;
  readonly accountId: string;
  readonly sessionId: string;
  readonly externalUserId?: string | null;
  readonly username?: string | null;
  readonly avatarConfigJson?: string | null;
  readonly nowIso?: string;
}): LocalAccountRoster {
  const nowIso = args.nowIso ?? new Date().toISOString();
  const existing = args.roster.find((row) => row.accountId === args.accountId);
  return upsertRosterEntry(args.roster, {
    accountId: args.accountId,
    sessionId: args.sessionId,
    externalUserId: coalesceRosterField(
      args.externalUserId,
      existing?.externalUserId
    ),
    username: coalesceRosterField(args.username, existing?.username),
    avatarConfigJson: coalesceRosterField(
      args.avatarConfigJson,
      existing?.avatarConfigJson
    ),
    lastActiveAt: nowIso,
  });
}
