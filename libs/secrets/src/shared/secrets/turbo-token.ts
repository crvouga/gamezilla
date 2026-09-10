import { cliHttp } from '../cli-io';
import { requireNonEmpty, Secret, type SecretInput } from './secret';

const TEAM_SLUG_RE = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i;

/** Self-hosted Turborepo remote cache origin (no trailing slash). */
export const DEFAULT_TURBO_API = 'https://turborepo.chrisvouga.dev';

function normalizeTurboApiOrigin(value: string, label: string): string {
  requireNonEmpty(value, label);
  const trimmed = value.trim().replace(/\/+$/, '');
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new Error(`${label} must be a valid URL`);
  }
  if (url.protocol !== 'https:') {
    throw new Error(`${label} must start with https://`);
  }
  if (url.pathname !== '' && url.pathname !== '/') {
    throw new Error(`${label} must be an origin only (no path)`);
  }
  if (url.search !== '' || url.hash !== '') {
    throw new Error(`${label} must be an origin only (no query or hash)`);
  }
  return trimmed;
}

function resolveTurboApiForValidation(input: SecretInput): string {
  const fromSecrets = (input.secrets.get('TURBO_API') ?? '').trim();
  if (fromSecrets.length > 0) {
    return normalizeTurboApiOrigin(fromSecrets, 'TURBO_API');
  }
  return DEFAULT_TURBO_API;
}

async function validateTurboApi(input: SecretInput): Promise<void> {
  normalizeTurboApiOrigin(input.secretValue, 'TURBO_API');
}

async function validateTurboToken(input: SecretInput): Promise<void> {
  const value = input.secretValue.trim();
  requireNonEmpty(value, 'TURBO_TOKEN');
  const api = resolveTurboApiForValidation(input);
  try {
    const res = await cliHttp.fetch(`${api}/v8/artifacts/status`, {
      headers: { Authorization: `Bearer ${value}` },
    });
    if (res.status === 401 || res.status === 403) {
      throw new Error(
        `Self-hosted Turbo cache rejected TURBO_TOKEN — HTTP ${String(res.status)}. ` +
          `Set TURBO_TOKEN to the shared Bearer token for ${api} ` +
          '(Vault / Infisical; never commit).'
      );
    }
  } catch (e) {
    if (e instanceof Error && e.message.startsWith('Self-hosted')) throw e;
    if (e instanceof Error && e.message.startsWith('TURBO_TOKEN')) throw e;
    // Network blip — don't fail secret validation on transient errors.
  }
}

export const TURBO_API = new Secret({
  name: 'TURBO_API',
  hint: `Self-hosted Turborepo remote cache origin (${DEFAULT_TURBO_API})`,
  mirrorToDev: true,
  validate: validateTurboApi,
  seed: async () => DEFAULT_TURBO_API,
});

export const TURBO_TOKEN = new Secret({
  name: 'TURBO_TOKEN',
  hint: `Shared Bearer token for self-hosted Turbo remote cache (${DEFAULT_TURBO_API})`,
  mirrorToDev: true,
  validate: validateTurboToken,
});

export const TURBO_TEAM = new Secret({
  name: 'TURBO_TEAM',
  hint: 'Team slug required by Turbo CLI (we use `local`)',
  mirrorToDev: true,
  validate: async (input) => {
    const value = input.secretValue.trim();
    if (!TEAM_SLUG_RE.test(value)) {
      throw new Error(
        `Invalid TURBO_TEAM "${value}" — expected a team slug (lowercase letters, digits, dashes)`
      );
    }
  },
  seed: async () => 'local',
});

export const TURBO_LOG_ORDER = new Secret({
  name: 'TURBO_LOG_ORDER',
  hint: 'stream | auto',
  optional: true,
  mirrorToDev: true,
  validate: async () => {},
  seed: async () => 'auto',
});

export const TURBO_CACHE = new Secret({
  name: 'TURBO_CACHE',
  hint: 'Always includes remote cache, e.g. local:rw,remote:rw. Remote cannot be disabled.',
  optional: true,
  mirrorToDev: true,
  validate: async (input) => {
    const value = input.secretValue.trim();
    if (!/^(local|remote):(r|rw|w)?(,(local|remote):(r|rw|w)?)?$/.test(value)) {
      throw new Error(
        `Invalid TURBO_CACHE value: ${value} (expected e.g. "local:rw,remote:rw")`
      );
    }
    if (!value.includes('remote:')) {
      throw new Error(
        `TURBO_CACHE must include remote cache (got ${value}; use "local:rw,remote:rw")`
      );
    }
  },
  seed: async () => 'local:rw,remote:rw',
});

export const TURBO_TELEMETRY_DISABLED = new Secret({
  name: 'TURBO_TELEMETRY_DISABLED',
  hint: '1',
  optional: true,
  mirrorToDev: true,
  validate: async () => {},
  seed: async () => '1',
});
