/**
 * Local multi-account roster persisted in Kv (not SecureStore — 2048-byte cap).
 * Session↔account binding only. Username/avatar come from SQLite `profiles`.
 */

export type LocalAccountRosterEntry = {
  readonly accountId: string;
  readonly sessionId: string;
  /** Auth-provider user id — survives session id rotation. */
  readonly externalUserId: string | null;
  /** ISO timestamp of last activation / refresh on this device. */
  readonly lastActiveAt: string;
};

export type LocalAccountRoster = readonly LocalAccountRosterEntry[];
