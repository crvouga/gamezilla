import { runCapture } from './subprocess';

/**
 * Each entry maps a Doppler secret name to the env var it should populate.
 * When both differ (e.g. Doppler stores "TF_TOKEN" but Terraform reads
 * "TF_TOKEN_app_terraform_io") we spell it out explicitly.
 */
const SECRET_MAP: ReadonlyArray<{ doppler: string; env: string }> = [
  { doppler: 'TF_TOKEN', env: 'TF_TOKEN_app_terraform_io' },
  { doppler: 'CLOUDFLARE_API_TOKEN', env: 'CLOUDFLARE_API_TOKEN' },
  { doppler: 'CLOUDFLARE_ACCOUNT_ID', env: 'CLOUDFLARE_ACCOUNT_ID' },
  { doppler: 'PLANETSCALE_SERVICE_TOKEN_ID', env: 'PLANETSCALE_SERVICE_TOKEN_ID' },
  { doppler: 'PLANETSCALE_SERVICE_TOKEN', env: 'PLANETSCALE_SERVICE_TOKEN' },
  { doppler: 'PLANETSCALE_ORG', env: 'TF_VAR_planetscale_org' },
];

export function getSecretMap(): ReadonlyArray<{ doppler: string; env: string }> {
  return SECRET_MAP;
}

/** Fetch a single Doppler secret by name. Throws if `doppler` CLI fails. */
export function fetchDopplerSecret(name: string): string {
  return runCapture('doppler', ['secrets', 'get', name, '--plain']);
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
