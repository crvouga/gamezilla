/** Better Auth core table names — single source for runtime + migrate + CI. */
export const BETTER_AUTH_TABLE_NAMES = {
  user: 'better_auth_user',
  session: 'better_auth_session',
  account: 'better_auth_account',
  verification: 'better_auth_verification',
} as const;

export type BetterAuthTableName =
  (typeof BETTER_AUTH_TABLE_NAMES)[keyof typeof BETTER_AUTH_TABLE_NAMES];
