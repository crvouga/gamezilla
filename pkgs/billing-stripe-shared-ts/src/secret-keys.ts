/** Secret names used by the Stripe billing adapter (same keys in `dev` and `prd`). */
export const StripeSecretKeys = {
  secretKey: 'STRIPE_SECRET_KEY',
  publishableKey: 'STRIPE_PUBLISHABLE_KEY',
  webhookSecret: 'STRIPE_WEBHOOK_SECRET',
} as const;

/**
 * Bindings a simulated Stripe is reached through, set by whoever boots one
 * (the localhost stack) and never managed as deployment secrets. Unset is
 * Stripe itself.
 */
export const StripeBindingKeys = {
  apiOrigin: 'STRIPE_API_ORIGIN',
} as const;
