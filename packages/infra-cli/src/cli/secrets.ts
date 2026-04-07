import { runCapture } from './subprocess';

export interface SecretEntry {
  readonly doppler: string;
  readonly env: string;
  readonly hint: string;
}

/**
 * Each entry maps a Doppler secret name to the env var it should populate.
 * When both differ (e.g. Doppler stores "TF_TOKEN" but Terraform reads
 * "TF_TOKEN_app_terraform_io") we spell it out explicitly.
 */
const SECRET_MAP: ReadonlyArray<SecretEntry> = [
  {
    doppler: 'TF_TOKEN',
    env: 'TF_TOKEN_app_terraform_io',
    hint: 'Terraform Cloud → User Settings → Tokens → Create an API token',
  },
  {
    doppler: 'CLOUDFLARE_API_TOKEN',
    env: 'CLOUDFLARE_API_TOKEN',
    hint: 'https://dash.cloudflare.com/profile/api-tokens → Create Token',
  },
  {
    doppler: 'CLOUDFLARE_ACCOUNT_ID',
    env: 'CLOUDFLARE_ACCOUNT_ID',
    hint: 'Cloudflare dashboard → any zone → Overview sidebar → Account ID',
  },
  {
    doppler: 'PLANETSCALE_SERVICE_TOKEN_ID',
    env: 'PLANETSCALE_SERVICE_TOKEN_ID',
    hint: 'PlanetScale → Org Settings → Service tokens → Create service token → Token ID',
  },
  {
    doppler: 'PLANETSCALE_SERVICE_TOKEN',
    env: 'PLANETSCALE_SERVICE_TOKEN',
    hint: 'PlanetScale → Org Settings → Service tokens → Create service token → Token value',
  },
  {
    doppler: 'PLANETSCALE_ORG',
    env: 'TF_VAR_planetscale_org',
    hint: 'Your PlanetScale organization slug (from the URL: app.planetscale.com/<org>)',
  },
];

export function getSecretMap(): ReadonlyArray<SecretEntry> {
  return SECRET_MAP;
}

/** Fetch a single Doppler secret by name. Throws if `doppler` CLI fails. */
export function fetchDopplerSecret(name: string): string {
  return runCapture('doppler', ['secrets', 'get', name, '--plain']);
}

/** Returns true if the secret exists in Doppler (non-empty). */
export function dopplerSecretExists(name: string): boolean {
  try {
    const value = fetchDopplerSecret(name);
    return value !== '';
  } catch {
    return false;
  }
}

/** Set a secret in Doppler. */
export function setDopplerSecret(name: string, value: string): void {
  runCapture('doppler', ['secrets', 'set', `${name}=${value}`]);
}

/**
 * Fetch all mapped secrets from Doppler and inject them into `process.env`.
 * Returns the key/value pairs that were set.
 */
export function loadSecretsIntoEnv(): Array<{ env: string; set: boolean }> {
  const results: Array<{ env: string; set: boolean }> = [];

  for (const { doppler, env } of SECRET_MAP) {
    try {
      const value = fetchDopplerSecret(doppler);
      process.env[env] = value;
      results.push({ env, set: true });
    } catch {
      results.push({ env, set: false });
    }
  }

  return results;
}
