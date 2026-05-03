import { isUuid } from '@gamezilla/domain/auth/device-id';

export const ACCOUNT_DB_PREFIX = 'app_account_';
export const ANONYMOUS_DB_PREFIX = 'app_anonymous_';

export type LocalAccountDbKind = 'account' | 'anonymous';

export type LocalAccountDbInfo = {
  readonly kind: LocalAccountDbKind;
  /** Canonical UUID (with hyphens) parsed from the flat filename segment. */
  readonly id: string;
  /** Basename passed to expo-sqlite `openDatabaseAsync` (no path). */
  readonly basename: string;
};

/** UUID string without hyphens, lowercase (safe for {@link assertDatabaseName}). */
export function uuidToFlat32(uuid: string): string {
  return uuid.replace(/-/g, '').toLowerCase();
}

/** Inverse of {@link uuidToFlat32}; returns null if `flat` is not 32 hex chars. */
export function flat32ToUuid(flat: string): string | null {
  if (!/^[0-9a-f]{32}$/i.test(flat)) return null;
  const x = flat.toLowerCase();
  return `${x.slice(0, 8)}-${x.slice(8, 12)}-${x.slice(12, 16)}-${x.slice(16, 20)}-${x.slice(20)}`;
}

export function accountDatabaseBasename(accountId: string): string {
  if (!isUuid(accountId)) {
    throw new Error(
      `accountDatabaseBasename: accountId must be a UUID, got ${String(accountId)}`
    );
  }
  return `${ACCOUNT_DB_PREFIX}${uuidToFlat32(accountId)}`;
}

export function anonymousDatabaseBasename(clientId: string): string {
  if (!isUuid(clientId)) {
    throw new Error(
      `anonymousDatabaseBasename: clientId must be a UUID, got ${String(clientId)}`
    );
  }
  return `${ANONYMOUS_DB_PREFIX}${uuidToFlat32(clientId)}`;
}

/**
 * Parses a database basename produced by this module. Returns null for unrelated files.
 */
export function tryParseAccountDatabaseBasename(
  basename: string
): LocalAccountDbInfo | null {
  if (basename.startsWith(ACCOUNT_DB_PREFIX)) {
    const flat = basename.slice(ACCOUNT_DB_PREFIX.length);
    const id = flat32ToUuid(flat);
    if (id === null) return null;
    return { kind: 'account', id, basename };
  }
  if (basename.startsWith(ANONYMOUS_DB_PREFIX)) {
    const flat = basename.slice(ANONYMOUS_DB_PREFIX.length);
    const id = flat32ToUuid(flat);
    if (id === null) return null;
    return { kind: 'anonymous', id, basename };
  }
  return null;
}
