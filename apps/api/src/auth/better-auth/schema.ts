/**
 * Better Auth physical Postgres tables + columns (raw SQL naming).
 * DDL is applied by `BetterAuthDbImplPostgres.migrateUp` in
 * `libs/lib/src/better-auth-db/impl-postgres.ts`.
 */

export const AuthTable = {
  user: 'auth_user',
  session: 'auth_session',
  account: 'auth_account',
  verification: 'auth_verification',
} as const;

/** Column names as stored in Postgres (snake_case). */
export const AuthUserColumn = {
  id: 'id',
  name: 'name',
  email: 'email',
  emailVerified: 'email_verified',
  image: 'image',
  createdAt: 'created_at',
  updatedAt: 'updated_at',
} as const;

export const AuthSessionColumn = {
  id: 'id',
  expiresAt: 'expires_at',
  token: 'token',
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  ipAddress: 'ip_address',
  userAgent: 'user_agent',
  userId: 'user_id',
} as const;

export const AuthAccountColumn = {
  id: 'id',
  accountId: 'account_id',
  providerId: 'provider_id',
  userId: 'user_id',
  accessToken: 'access_token',
  refreshToken: 'refresh_token',
  idToken: 'id_token',
  accessTokenExpiresAt: 'access_token_expires_at',
  refreshTokenExpiresAt: 'refresh_token_expires_at',
  scope: 'scope',
  password: 'password',
  createdAt: 'created_at',
  updatedAt: 'updated_at',
} as const;

export const AuthVerificationColumn = {
  id: 'id',
  identifier: 'identifier',
  value: 'value',
  expiresAt: 'expires_at',
  createdAt: 'created_at',
  updatedAt: 'updated_at',
} as const;
