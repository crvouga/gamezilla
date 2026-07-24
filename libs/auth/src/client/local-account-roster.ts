import { asKeyword } from '@pkgs/keyword/keyword';
import type { KvStateCodec } from '@pkgs/kv/kv-state-codec';
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

/**
 * Accepts legacy Kv rows that still carry username/avatarConfigJson and strips
 * those display fields — SQLite `profiles` is the only display source.
 */
function parseRosterEntry(value: unknown): LocalAccountRosterEntry | null {
  if (typeof value !== 'object' || value === null) return null;
  const row = value as Record<string, unknown>;
  const externalOk =
    row['externalUserId'] === undefined ||
    isNullableString(row['externalUserId']);
  if (
    typeof row['accountId'] !== 'string' ||
    typeof row['sessionId'] !== 'string' ||
    !externalOk ||
    typeof row['lastActiveAt'] !== 'string'
  ) {
    return null;
  }
  return {
    accountId: row['accountId'],
    sessionId: row['sessionId'],
    externalUserId:
      typeof row['externalUserId'] === 'string' ? row['externalUserId'] : null,
    lastActiveAt: row['lastActiveAt'],
  };
}

function normalizeRoster(value: unknown): LocalAccountRoster | undefined {
  if (!Array.isArray(value)) return undefined;
  const next: LocalAccountRosterEntry[] = [];
  for (const row of value) {
    const parsed = parseRosterEntry(row);
    if (parsed === null) return undefined;
    next.push(parsed);
  }
  return next;
}

function isNormalizedRoster(value: unknown): value is LocalAccountRoster {
  return normalizeRoster(value) !== undefined;
}

const baseCodec = jsonKvCodec(
  LOCAL_ACCOUNT_ROSTER_VALUE_ATTR,
  isNormalizedRoster
);

/** Decode strips legacy display fields; encode persists binding-only rows. */
export const localAccountRosterCodec: KvStateCodec<LocalAccountRoster> = {
  decode(record) {
    const raw = baseCodec.decode(record);
    if (raw === undefined) return undefined;
    return normalizeRoster(raw) ?? undefined;
  },
  encode(value) {
    return baseCodec.encode(value);
  },
};

/** Session id placeholder so a detached row stays findable by externalUserId. */
export function detachedRosterSessionId(accountId: string): string {
  return `detached:${accountId}`;
}

/**
 * Upsert by account id. If another account still holds this session id (stale
 * binding after a switch/refresh race), detach that row instead of deleting it.
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

function coalesceExternalUserId(
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
  readonly nowIso?: string;
}): LocalAccountRoster {
  const nowIso = args.nowIso ?? new Date().toISOString();
  const existing = args.roster.find((row) => row.accountId === args.accountId);
  return upsertRosterEntry(args.roster, {
    accountId: args.accountId,
    sessionId: args.sessionId,
    externalUserId: coalesceExternalUserId(
      args.externalUserId,
      existing?.externalUserId
    ),
    lastActiveAt: nowIso,
  });
}
