/** Secret names used by the Stripe billing adapter (same keys in `dev` and `prd`). */
export const StripeSecretKeys = {
  secretKey: 'STRIPE_SECRET_KEY',
  publishableKey: 'STRIPE_PUBLISHABLE_KEY',
} as const;
