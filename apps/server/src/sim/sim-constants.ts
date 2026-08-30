/** Fixed sim IdP secret (32+ chars). */
export const SIM_AUTH_SECRET = 'sim-auth-secret-0123456789abcdef012345';

/** Placeholder auth origin used during migrate (no network is used). */
export const SIM_SERVER_URL = 'http://sim.local';

/** Placeholder DATABASE_URL for secret-store / config (SQLite has no TCP listener). */
export const SIM_SQLITE_DATABASE_URL = 'sqlite://sim';
