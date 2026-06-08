/** Secret names used by Stripe integration (same keys in `dev` and `prd` configs). */
export const StripeSecretKeys = {
  secretKey: 'STRIPE_SECRET_KEY',
  webhookSecret: 'STRIPE_WEBHOOK_SECRET',
} as const;
