import { StripeSecretKeys } from '@gamezilla/stripe/doppler-keys';

/** Doppler keys — same names in `local` and `prod` configs. */
export const ApiSecretName = {
  googleWebClientId: 'WEB_CLIENT_GOOGLE_CLIENT_ID',
  googleWebClientSecret: 'WEB_CLIENT_GOOGLE_CLIENT_SECRET',
  /** Secret for Better Auth session signing (`bun` / openssl random hex). */
  betterAuthSecret: 'BETTER_AUTH_SECRET',
  /** Optional display name; defaults to `gamezilla` when unset or blank. */
  betterAuthAppName: 'BETTER_AUTH_APP_NAME',
  /**
   * Optional newline-separated extra `trustedOrigins` for Better Auth (e.g.
   * staging URLs). When set (any non-blank line), origins are exactly
   * `API_URL` origin plus these lines. When unset, defaults include mobile
   * deep links and local wrangler URLs when `API_URL` points at localhost.
   */
  betterAuthTrustedOrigins: 'BETTER_AUTH_TRUSTED_ORIGINS',
  dbUrl: 'DB_URL',
  apiUrl: 'API_URL',
  stripeSecretKey: StripeSecretKeys.secretKey,
  stripeWebhookSecret: StripeSecretKeys.webhookSecret,
} as const;
