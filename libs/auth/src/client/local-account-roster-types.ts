/**
 * Local multi-account roster persisted in Kv (not SecureStore — 2048-byte cap).
 * Session↔account binding plus last-known username/avatar for the switcher
 * (inactive accounts have no live SQLite profile — only one identity DB is
 * active at a time).
 */

export type LocalAccountRosterEntry = {
  readonly accountId: string;
  readonly sessionId: string;
  /** Auth-provider user id — survives session id rotation. */
  readonly externalUserId: string | null;
  readonly username: string | null;
  /** Serialized profile avatar config JSON, or null until synced. */
  readonly avatarConfigJson: string | null;
  /** ISO timestamp of last activation / refresh on this device. */
  readonly lastActiveAt: string;
};

export type LocalAccountRoster = readonly LocalAccountRosterEntry[];
