/**
 * Local multi-account roster persisted in Kv (not SecureStore — 2048-byte cap).
 * Display metadata for the avatar switcher; the auth provider owns live session tokens.
 */

export type LocalAccountRosterEntry = {
  readonly accountId: string;
  readonly sessionId: string;
  /** Clerk (or other provider) user id — survives session id rotation. */
  readonly externalUserId: string | null;
  readonly username: string | null;
  /** Serialized profile avatar config JSON, or null until synced. */
  readonly avatarConfigJson: string | null;
  /** ISO timestamp of last activation / refresh on this device. */
  readonly lastActiveAt: string;
};

export type LocalAccountRoster = readonly LocalAccountRosterEntry[];
