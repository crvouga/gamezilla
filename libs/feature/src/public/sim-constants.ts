/**
 * Fixed addresses and secrets a simulated app boots with.
 *
 * They live in the platform rather than in a shell because every host — the
 * product sim, a subsystem harness, the localhost stack — has to agree on
 * them, and none of them owns the others. Nothing here is a secret: a sim
 * reaches no network it did not create.
 */

/** Fixed sim IdP secret (32+ chars). */
export const SIM_AUTH_SECRET = 'sim-auth-secret-0123456789abcdef012345';

/** Placeholder auth origin used during migrate (no network is used). */
export const SIM_SERVER_URL = 'http://sim.local';

/** Placeholder DATABASE_URL for secret-store / config (SQLite has no TCP listener). */
export const SIM_SQLITE_DATABASE_URL = 'sqlite://sim';

/** Origin of the simulated Google IdP node inside a sim. */
export const SIM_IDP_URL = 'http://idp.sim';

/** OAuth client the sim API registers with that provider. */
export const SIM_GOOGLE_CLIENT_ID = 'sim.apps.googleusercontent.com';
export const SIM_GOOGLE_CLIENT_SECRET = 'sim-google-client-secret';

/** Origin of the mock payment provider node inside a sim. */
export const SIM_BILLING_URL = 'http://billing.sim';

/** The key the sim API's billing adapter calls that provider with. */
export const SIM_BILLING_SECRET_KEY = 'sk_test_mock_sim';

/** The secret that provider signs its webhooks to the sim API with. */
export const SIM_BILLING_WEBHOOK_SECRET = 'whsec_mock_sim';
