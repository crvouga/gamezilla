import { cliHttp } from '../lib/cli-io';
import { requireNonEmpty, Secret, type SecretInput } from './secret';

const TEAM_SLUG_RE = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i;

/**
 * Vercel Remote Cache origin is baked into the turbo CLI, so there is no
 * `TURBO_API` secret — only the scoped access token and the team it belongs to.
 */
const ARTIFACTS_STATUS_URL = 'https://vercel.com/api/v8/artifacts/status';

/** Turbo passes `teamId` for `team_…` ids and `slug` for team slugs. */
function buildArtifactsStatusUrl(team: string): string {
  const key = team.startsWith('team_') ? 'teamId' : 'slug';
  return `${ARTIFACTS_STATUS_URL}?${key}=${encodeURIComponent(team)}`;
}

async function validateTurboToken(input: SecretInput): Promise<void> {
  const value = input.secretValue.trim();
  requireNonEmpty(value, 'TURBO_TOKEN');
  const team = (input.secrets.get('TURBO_TEAM') ?? '').trim();
  if (team === '') return;
  try {
    const res = await cliHttp.fetch(buildArtifactsStatusUrl(team), {
      headers: { Authorization: `Bearer ${value}` },
    });
    if (res.status === 401 || res.status === 403) {
      throw new Error(
        `Vercel rejected TURBO_TOKEN for team "${team}" — HTTP ${String(res.status)}. ` +
          'Mint a scoped access token at https://vercel.com/account/settings/tokens ' +
          'and make sure its scope covers TURBO_TEAM.'
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
  hint: 'Vercel scoped access token (https://vercel.com/account/settings/tokens) for Remote Cache',
  mirrorToDev: true,
  validate: validateTurboToken,
});

export const TURBO_TEAM = new Secret({
  name: 'TURBO_TEAM',
  hint: 'Vercel team slug that owns the Remote Cache (we use `crvouga`)',
  mirrorToDev: true,
  validate: async (input) => {
    const value = input.secretValue.trim();
    if (!TEAM_SLUG_RE.test(value)) {
      throw new Error(
        `Invalid TURBO_TEAM "${value}" — expected a Vercel team slug (lowercase letters, digits, dashes)`
      );
    }
  },
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
  hint: 'local:rw for local-only; local:rw,remote:rw (or remote:rw) for Vercel Remote Cache. CI uses local:rw,remote:rw when TURBO_TOKEN/TURBO_TEAM are set.',
  optional: true,
  mirrorToDev: true,
  validate: async (input) => {
    const value = input.secretValue.trim();
    if (!/^(local|remote):(r|rw|w)?(,(local|remote):(r|rw|w)?)?$/.test(value)) {
      throw new Error(
        `Invalid TURBO_CACHE value: ${value} (expected e.g. "local:rw,remote:rw")`
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
