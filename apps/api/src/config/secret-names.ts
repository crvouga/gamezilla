import { StripeSecretKeys } from '@gamezilla/stripe/doppler-keys';

/** Doppler keys — same names in `local` and `prod` configs. */
export const ApiSecretName = {
  googleWebClientId: 'WEB_CLIENT_GOOGLE_CLIENT_ID',
  dbUrl: 'DB_URL',
  apiUrl: 'API_URL',
  stripeSecretKey: StripeSecretKeys.secretKey,
  stripeWebhookSecret: StripeSecretKeys.webhookSecret,
} as const;
