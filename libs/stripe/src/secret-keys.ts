/** Doppler secret names used by Stripe integration (same keys in `local` and `prod` configs). */
export const StripeSecretKeys = {
  secretKey: 'STRIPE_SECRET_KEY',
  webhookSecret: 'STRIPE_WEBHOOK_SECRET',
} as const;
