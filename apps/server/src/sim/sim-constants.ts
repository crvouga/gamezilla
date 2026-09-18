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
