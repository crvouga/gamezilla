/** Fixed sim IdP secret (32+ chars). */
export const SIM_AUTH_SECRET = 'sim-auth-secret-0123456789abcdef012345';

/**
 * Fixture billing secrets for the acceptance harness. These are not
 * vendor credentials. `STRIPE_WEBHOOK_SECRET` is the signing key the billing
 * webhook must verify; `STRIPE_SECRET_KEY` lets a provider adapter boot.
 */
export const SIM_STRIPE_WEBHOOK_SECRET_NAME = 'STRIPE_WEBHOOK_SECRET';
export const SIM_STRIPE_WEBHOOK_SECRET = 'acceptance-webhook-secret';
export const SIM_STRIPE_SECRET_KEY_NAME = 'STRIPE_SECRET_KEY';
export const SIM_STRIPE_SECRET_KEY = 'acceptance-stripe-secret';

/** Placeholder auth origin used during migrate (no network is used). */
export const SIM_SERVER_URL = 'http://sim.local';

/** Placeholder DATABASE_URL for secret-store / config (SQLite has no TCP listener). */
export const SIM_SQLITE_DATABASE_URL = 'sqlite://sim';
