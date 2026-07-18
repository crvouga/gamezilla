import { asKeyword } from '@pkgs/keyword/keyword';
import { jsonKvCodec } from '@pkgs/kv/kv-state-codec';

import type {
  LocalAccountRoster,
  LocalAccountRosterEntry,
} from './local-account-roster-types';

export const LOCAL_ACCOUNT_ROSTER_KEY = asKeyword('auth.roster/accounts');
const LOCAL_ACCOUNT_ROSTER_VALUE_ATTR = asKeyword('auth.roster/value');

function isRosterEntry(value: unknown): value is LocalAccountRosterEntry {
  if (typeof value !== 'object' || value === null) return false;
  const row = value as LocalAccountRosterEntry;
  return (
    typeof row.accountId === 'string' &&
    typeof row.sessionId === 'string' &&
    (row.username === null || typeof row.username === 'string') &&
    (row.avatarConfigJson === null ||
      typeof row.avatarConfigJson === 'string') &&
    typeof row.lastActiveAt === 'string'
  );
}

function isRoster(value: unknown): value is LocalAccountRoster {
  return Array.isArray(value) && value.every(isRosterEntry);
}

export const localAccountRosterCodec = jsonKvCodec(
  LOCAL_ACCOUNT_ROSTER_VALUE_ATTR,
  isRoster
);

export function upsertRosterEntry(
  roster: LocalAccountRoster,
  entry: LocalAccountRosterEntry
): LocalAccountRoster {
  const without = roster.filter(
    (row) =>
      row.accountId !== entry.accountId && row.sessionId !== entry.sessionId
  );
  return [entry, ...without];
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

export function touchRosterAccount(args: {
  readonly roster: LocalAccountRoster;
  readonly accountId: string;
  readonly sessionId: string;
  readonly username?: string | null;
  readonly avatarConfigJson?: string | null;
  readonly nowIso?: string;
}): LocalAccountRoster {
  const nowIso = args.nowIso ?? new Date().toISOString();
  const existing = args.roster.find(
    (row) => row.accountId === args.accountId
  );
  return upsertRosterEntry(args.roster, {
    accountId: args.accountId,
    sessionId: args.sessionId,
    username: args.username ?? existing?.username ?? null,
    avatarConfigJson:
      args.avatarConfigJson ?? existing?.avatarConfigJson ?? null,
    lastActiveAt: nowIso,
  });
}
