import { NAMESPACE } from '@libs/product-identity-shared-ts/product-identity';

/**
 * Fixed addresses and secrets a simulated app boots with.
 *
 * They live in the platform rather than in a shell because every host — the
 * product harness, a subsystem harness, the localhost stack — has to agree on
 * them, and none of them owns the others. Nothing here is a secret: a harness
 * reaches no network it did not create.
 */

/** Fixed harness IdP secret (32+ chars). */
export const HARNESS_AUTH_SECRET = 'harness-auth-secret-0123456789abcdef012345';

/** Placeholder auth origin used during migrate (no network is used). */
export const HARNESS_SERVER_URL = 'http://harness.local';

/** Placeholder DATABASE_URL for secret-store / config (SQLite has no TCP listener). */
export const HARNESS_SQLITE_DATABASE_URL = 'sqlite://harness';

/** Origin of the simulated Google IdP node inside a harness. */
export const HARNESS_IDP_URL = 'http://idp.harness';

/** OAuth client the harness API registers with that provider. */
export const HARNESS_GOOGLE_CLIENT_ID = 'harness.apps.googleusercontent.com';
export const HARNESS_GOOGLE_CLIENT_SECRET = 'harness-google-client-secret';

/** Origin of the simulated Apple provider (Sign in with Apple, mock-only). */
export const HARNESS_APPLE_IDP_URL = 'http://appleid.harness';

/** The Services ID + developer team + key id the harness API is known by there. */
export const HARNESS_APPLE_CLIENT_ID = `harness.${NAMESPACE}.signin`;
export const HARNESS_APPLE_TEAM_ID = 'SIMTEAM001';
export const HARNESS_APPLE_KEY_ID = 'SIMKEY0001';

/** Origin of the payment provider node (Stripe, simulated) inside a harness. */
export const HARNESS_BILLING_URL = 'http://billing.harness';

/**
 * The provider id of the harness's first payment provider — the one it boots
 * with, Stripe's own id. A harness can take on more (a switch of payment
 * provider to a second Stripe account); each gets its own id and origin.
 */
export const HARNESS_FIRST_BILLING_PROVIDER = 'stripe';

/** Origin of the harness's payment provider `provider`. */
export function harnessBillingOrigin(provider: string): string {
  return provider === HARNESS_FIRST_BILLING_PROVIDER
    ? HARNESS_BILLING_URL
    : `http://${provider}.billing.harness`;
}

/** Whether `origin` is one of the harness's payment providers. */
export function isHarnessBillingOrigin(origin: string): boolean {
  return (
    origin === HARNESS_BILLING_URL ||
    /^http:\/\/[a-z][a-z0-9-]*\.billing\.harness$/.test(origin)
  );
}

/** The test-mode key the harness API's billing adapter calls that provider with. */
export const HARNESS_BILLING_SECRET_KEY = 'sk_test_harness';
