import { cliHttp } from './cli-io';
import type { SecretInput } from './secret';
import { requireNonEmpty, Secret } from './secret';

/** Vercel Remote Cache API origin (no trailing slash). */
export const TURBO_API = 'https://api.vercel.com';

/**
 * Vercel team slug that owns the Remote Cache. A constant, not a secret:
 * every secret value is masked in GitHub Actions logs, and the slug is not
 * sensitive. Also `remoteCache.teamSlug` in the root `turbo.json`.
 */
export const TURBO_TEAM = 'crvougas-projects';

async function validateTurboToken(input: SecretInput): Promise<void> {
  const value = input.secretValue.trim();
  requireNonEmpty(value, 'TURBO_TOKEN');
  try {
    const res = await cliHttp.fetch(
      `${TURBO_API}/v8/artifacts/status?slug=${TURBO_TEAM}`,
      { headers: { Authorization: `Bearer ${value}` } }
    );
    if (res.status === 401 || res.status === 403) {
      throw new Error(
        `Vercel Remote Cache rejected TURBO_TOKEN — HTTP ${String(res.status)}. ` +
          `Set TURBO_TOKEN to a Vercel access token scoped to ${TURBO_TEAM} ` +
          '(Vault / Infisical; never commit).'
      );
    }
  } catch (e) {
    if (e instanceof Error && e.message.startsWith('Vercel')) throw e;
    if (e instanceof Error && e.message.startsWith('TURBO_TOKEN')) throw e;
    // Network blip — don't fail secret validation on transient errors.
  }
}

export const TURBO_TOKEN = new Secret({
  name: 'TURBO_TOKEN',
  hint: `Vercel access token for the ${TURBO_TEAM} Remote Cache`,
  validate: validateTurboToken,
});
