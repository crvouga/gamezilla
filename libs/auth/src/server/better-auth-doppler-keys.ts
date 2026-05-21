/**
 * Doppler secret **names** read by Better Auth bootstrap. Keep aligned with
 * `apps/api/src/config/secret-names.ts` (`ApiSecretName`).
 */
export const BetterAuthDopplerKey = {
  googleWebClientId: 'WEB_CLIENT_GOOGLE_CLIENT_ID',
  googleWebClientSecret: 'WEB_CLIENT_GOOGLE_CLIENT_SECRET',
  betterAuthSecret: 'BETTER_AUTH_SECRET',
  betterAuthAppName: 'BETTER_AUTH_APP_NAME',
  betterAuthTrustedOrigins: 'BETTER_AUTH_TRUSTED_ORIGINS',
  dbUrl: 'DB_URL',
  apiUrl: 'API_URL',
} as const;
