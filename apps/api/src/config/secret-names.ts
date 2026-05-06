import { StripeSecretKeys } from '@gamezilla/stripe/doppler-keys';

/** Doppler keys — same names in `local` and `prod` configs. */
export const ApiSecretName = {
  googleWebClientId: 'WEB_CLIENT_GOOGLE_CLIENT_ID',
  /** Clerk Backend API secret (`sk_…`) — JWT verification + server-side Clerk API. */
  clerkSecretKey: 'CLERK_SECRET_KEY',
  /** Clerk publishable key (`pk_…`) — pushed to clientConfig singleton for clients. */
  clerkPublishableKey: 'CLERK_PUBLISHABLE_KEY',
  dbUrl: 'DB_URL',
  apiUrl: 'API_URL',
  stripeSecretKey: StripeSecretKeys.secretKey,
  stripeWebhookSecret: StripeSecretKeys.webhookSecret,
} as const;
