/** Fixed sim Better Auth secret (32+ chars — Better Auth requires length). */
export const SIM_BETTER_AUTH_SECRET = 'sim-better-auth-secret-0123456789abcdef';

/** Placeholder auth origin used during migrate (no network is used). */
export const SIM_SERVER_URL = 'http://sim.local';

/** Placeholder DATABASE_URL for secret-store / config (SQLite has no TCP listener). */
export const SIM_SQLITE_DATABASE_URL = 'sqlite://sim';
