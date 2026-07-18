import { Secret, requireNonEmpty, type SecretInput } from './secret';

const TEAM_SLUG_RE = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i;

async function validateTurboApi(input: SecretInput): Promise<void> {
  const value = input.secretValue.trim();
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') {
      throw new Error(`TURBO_API must be an https URL, got "${value}"`);
    }
    if (
      url.hostname === 'vercel.com' ||
      url.hostname.endsWith('.vercel.com')
    ) {
      throw new Error(
        `TURBO_API must not point at Vercel (got "${value}") — use the self-hosted cache`
      );
    }
  } catch (e) {
    if (e instanceof Error && e.message.startsWith('TURBO_API')) throw e;
    throw new Error(
      `Invalid TURBO_API "${value}" — expected an https URL (e.g. https://turborepo.chrisvouga.dev)`
    );
  }
}

export const TURBO_API = new Secret({
  name: 'TURBO_API',
  hint: 'Self-hosted cache origin (e.g. https://turborepo.chrisvouga.dev)',
  mirrorToDev: true,
  validate: validateTurboApi,
});

export const TURBO_TOKEN = new Secret({
  name: 'TURBO_TOKEN',
  hint: 'Bearer token the self-hosted turborepo-remote-cache validates',
  mirrorToDev: true,
  validate: async (input) => {
    requireNonEmpty(input.secretValue, 'TURBO_TOKEN');
  },
});

export const TURBO_TEAM = new Secret({
  name: 'TURBO_TEAM',
  hint: 'Any team slug (we use `crvouga`) — required by the turbo CLI for remote cache',
  mirrorToDev: true,
  validate: async (input) => {
    const value = input.secretValue.trim();
    if (!TEAM_SLUG_RE.test(value)) {
      throw new Error(
        `Invalid TURBO_TEAM "${value}" — expected a slug (lowercase letters, digits, dashes)`
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
  hint: 'remote:rw',
  optional: true,
  mirrorToDev: true,
  validate: async (input) => {
    const value = input.secretValue.trim();
    if (!/^(local|remote):(r|rw|w)?(,(local|remote):(r|rw|w)?)?$/.test(value)) {
      throw new Error(
        `Invalid TURBO_CACHE value: ${value} (expected e.g. "remote:rw")`
      );
    }
  },
  seed: async () => 'remote:rw',
});

export const TURBO_TELEMETRY_DISABLED = new Secret({
  name: 'TURBO_TELEMETRY_DISABLED',
  hint: '1',
  optional: true,
  mirrorToDev: true,
  validate: async () => {},
  seed: async () => '1',
});
