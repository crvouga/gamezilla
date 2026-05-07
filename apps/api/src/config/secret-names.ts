import { StripeSecretKeys } from '@gamezilla/stripe/doppler-keys';

/** Doppler keys — same names in `local` and `prod` configs. */
export const ApiSecretName = {
  googleWebClientId: 'WEB_CLIENT_GOOGLE_CLIENT_ID',
  googleWebClientSecret: 'WEB_CLIENT_GOOGLE_CLIENT_SECRET',
  /** Secret for Better Auth session signing (`bun` / openssl random hex). */
  betterAuthSecret: 'BETTER_AUTH_SECRET',
  dbUrl: 'DB_URL',
  apiUrl: 'API_URL',
  stripeSecretKey: StripeSecretKeys.secretKey,
  stripeWebhookSecret: StripeSecretKeys.webhookSecret,
} as const;
