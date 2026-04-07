import { runCapture } from './subprocess';

export interface SecretEntry {
  readonly doppler: string;
  readonly env: string;
  readonly hint: string;
  readonly validate?: (value: string) => Promise<string | null>;
}

/** Returns `null` if valid, or an error message if invalid. */
export async function validateSecret(
  entry: SecretEntry,
  value: string
): Promise<string | null> {
  if (entry.validate === undefined) return null;
  return entry.validate(value);
}

const HEX32_RE = /^[0-9a-f]{32}$/;
const SLUG_RE = /^[a-z0-9][a-z0-9-]*[a-z0-9]$/;

function cfHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

async function validateTfToken(token: string): Promise<string | null> {
  try {
    const res = await fetch('https://app.terraform.io/api/v2/account/details', {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/vnd.api+json',
      },
    });
    if (res.ok) return null;
    if (res.status === 401) return 'Token is invalid or expired';
    return `Terraform Cloud API returned HTTP ${res.status}`;
  } catch (e) {
    return `Terraform Cloud API unreachable: ${e instanceof Error ? e.message : String(e)}`;
  }
}

async function validateCfApiToken(token: string): Promise<string | null> {
  try {
    const headers = cfHeaders(token);

    const res = await fetch(
      'https://api.cloudflare.com/client/v4/user/tokens/verify',
      { headers }
    );
    if (!res.ok) return `Cloudflare API returned HTTP ${res.status}`;
    const body = (await res.json()) as { result?: { status?: string } };
    if (body.result?.status !== 'active') {
      return `Token status is "${body.result?.status ?? 'unknown'}", expected "active"`;
    }

    const acctRes = await fetch(
      'https://api.cloudflare.com/client/v4/accounts',
      { headers }
    );
    if (!acctRes.ok)
      return `Token cannot list accounts (HTTP ${acctRes.status}) — check permissions`;
    const acctBody = (await acctRes.json()) as {
      result?: Array<{ id: string }>;
    };
    if (!acctBody.result?.length)
      return 'Token has no accessible accounts — check account scope';

    const accountId = acctBody.result[0].id;

    const checks: Array<{ label: string; probe: Promise<boolean> }> = [
      {
        label: 'Account → Cloudflare Pages → Edit',
        probe: probeCfPermission(
          headers,
          'GET',
          `https://api.cloudflare.com/client/v4/accounts/${accountId}/pages/projects`
        ),
      },
      {
        label: 'Account → Workers Scripts → Edit',
        probe: probeCfPermission(
          headers,
          'GET',
          `https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/scripts`
        ),
      },
    ];

    const zonesRes = await fetch(
      `https://api.cloudflare.com/client/v4/zones?account.id=${accountId}&per_page=1`,
      { headers }
    );
    if (zonesRes.ok) {
      const zonesBody = (await zonesRes.json()) as {
        result?: Array<{ id: string }>;
      };
      const zoneId = zonesBody.result?.[0]?.id;
      if (zoneId) {
        checks.push({
          label: 'Zone → DNS → Edit',
          probe: probeCfPermission(
            headers,
            'GET',
            `https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records?per_page=1`
          ),
        });
      }
    } else {
      checks.unshift({
        label: 'Zone → Zone → Read',
        probe: Promise.resolve(false),
      });
    }

    return null;
  } catch (e) {
    return `Cloudflare API unreachable: ${e instanceof Error ? e.message : String(e)}`;
  }
}

/**
 * Probe whether the token has a specific Cloudflare permission by making a
 * real API call.  Returns `true` if the token has access (any non-403 status),
 * `false` if 403/unauthorized.
 */
async function probeCfPermission(
  headers: Record<string, string>,
  method: string,
  url: string,
  jsonBody?: unknown
): Promise<boolean> {
  try {
    const opts: RequestInit = { method, headers };
    if (jsonBody !== undefined) opts.body = JSON.stringify(jsonBody);
    const res = await fetch(url, opts);
    await res.arrayBuffer();
    return res.status !== 403;
  } catch {
    return true;
  }
}

async function validateCfAccountId(accountId: string): Promise<string | null> {
  if (!HEX32_RE.test(accountId)) return 'Must be a 32-character hex string';
  const token = process.env['CLOUDFLARE_API_TOKEN'];
  if (!token) return null;
  try {
    const res = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}`,
      {
        headers: cfHeaders(token),
      }
    );
    if (res.ok) return null;
    if (res.status === 404) return 'Account not found — check the ID';
    if (res.status === 403) return 'Token does not have access to this account';
    return `Cloudflare API returned HTTP ${res.status}`;
  } catch {
    return null;
  }
}

async function validatePsCredentials(
  value: string,
  kind: 'id' | 'token'
): Promise<string | null> {
  if (value.length === 0) return 'Must be a non-empty string';
  const id =
    kind === 'id' ? value : process.env['PLANETSCALE_SERVICE_TOKEN_ID'];
  const token =
    kind === 'token' ? value : process.env['PLANETSCALE_SERVICE_TOKEN'];
  if (!id || !token) return null;
  try {
    const res = await fetch('https://api.planetscale.com/v1/organizations', {
      headers: {
        Authorization: `${id}:${token}`,
        Accept: 'application/json',
      },
    });
    if (res.ok) return null;
    if (res.status === 401 || res.status === 403)
      return 'Service token credentials are invalid';
    return `PlanetScale API returned HTTP ${res.status}`;
  } catch {
    return null;
  }
}

async function validatePsOrg(slug: string): Promise<string | null> {
  if (!SLUG_RE.test(slug)) return 'Must be a lowercase slug (e.g. "my-org")';
  const id = process.env['PLANETSCALE_SERVICE_TOKEN_ID'];
  const token = process.env['PLANETSCALE_SERVICE_TOKEN'];
  if (!id || !token) return null;
  try {
    const res = await fetch(
      `https://api.planetscale.com/v1/organizations/${slug}`,
      {
        headers: {
          Authorization: `${id}:${token}`,
          Accept: 'application/json',
        },
      }
    );
    if (res.ok) return null;
    if (res.status === 404) return `Organization "${slug}" not found`;
    if (res.status === 403)
      return `Token does not have access to org "${slug}"`;
    return `PlanetScale API returned HTTP ${res.status}`;
  } catch {
    return null;
  }
}

async function validatePsDatabase(name: string): Promise<string | null> {
  if (!SLUG_RE.test(name))
    return 'Must be a lowercase slug (e.g. "production")';
  const id = process.env['PLANETSCALE_SERVICE_TOKEN_ID'];
  const token = process.env['PLANETSCALE_SERVICE_TOKEN'];
  const org = process.env['TF_VAR_planetscale_org'];
  if (!id || !token || !org) return null;
  try {
    const res = await fetch(
      `https://api.planetscale.com/v1/organizations/${org}/databases/${name}`,
      {
        headers: {
          Authorization: `${id}:${token}`,
          Accept: 'application/json',
        },
      }
    );
    if (res.ok) return null;
    if (res.status === 404)
      return `Database "${name}" not found in org "${org}" — create it at https://app.planetscale.com/${org}`;
    if (res.status === 403)
      return `Token does not have access to database "${name}"`;
    return `PlanetScale API returned HTTP ${res.status}`;
  } catch {
    return null;
  }
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
    hint: 'https://app.terraform.io/app/settings/tokens → Create an API token',
    validate: validateTfToken,
  },
  {
    doppler: 'CLOUDFLARE_API_TOKEN',
    env: 'CLOUDFLARE_API_TOKEN',
    hint: [
      'https://dash.cloudflare.com/profile/api-tokens → Create Token',
      'Required permissions:',
      '  Zone → Zone → Edit',
      '  Zone → DNS → Edit',
      '  Account → Cloudflare Pages → Edit',
      '  Account → Workers Scripts → Edit',
      'Zone Resources: All zones  |  Account Resources: All accounts',
    ].join('\n'),
    validate: validateCfApiToken,
  },
  {
    doppler: 'CLOUDFLARE_ACCOUNT_ID',
    env: 'TF_VAR_cloudflare_account_id',
    hint: 'https://dash.cloudflare.com/ → pick any zone → Overview sidebar → Account ID',
    validate: validateCfAccountId,
  },
  {
    doppler: 'PLANETSCALE_SERVICE_TOKEN_ID',
    env: 'PLANETSCALE_SERVICE_TOKEN_ID',
    hint: 'https://app.planetscale.com/ → Org Settings → Service tokens → Token ID',
    validate: (v) => validatePsCredentials(v, 'id'),
  },
  {
    doppler: 'PLANETSCALE_SERVICE_TOKEN',
    env: 'PLANETSCALE_SERVICE_TOKEN',
    hint: 'https://app.planetscale.com/ → Org Settings → Service tokens → Token value',
    validate: (v) => validatePsCredentials(v, 'token'),
  },
  {
    doppler: 'PLANETSCALE_ORG',
    env: 'TF_VAR_planetscale_org',
    hint: 'Your PlanetScale org slug (from URL: https://app.planetscale.com/<org>)',
    validate: validatePsOrg,
  },
  {
    doppler: 'PLANETSCALE_DATABASE',
    env: 'TF_VAR_planetscale_database',
    hint: 'PlanetScale database name — must already exist (e.g. "production")',
    validate: validatePsDatabase,
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
