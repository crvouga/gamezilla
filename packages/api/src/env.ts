export interface Env {
  DATABASE_URL: string;
  /** Optional: Google Web client ID for verifying id_token `aud`. */
  GOOGLE_CLIENT_ID?: string;
}

/**
 * Validates Worker env bindings at the start of each request (cheap; runs once
 * in practice because `getDb` caches). Throws immediately on misconfiguration.
 */
export function validateEnv(env: Env): void {
  if (typeof env.DATABASE_URL !== 'string' || env.DATABASE_URL.length === 0) {
    throw new Error('DATABASE_URL env var is required and must be non-empty');
  }
}
