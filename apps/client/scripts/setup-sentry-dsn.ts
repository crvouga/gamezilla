import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

import { assert } from '@pkgs/assert';
import {
  createVaultSecretStoreForScripts,
  type SecretStore,
} from '@pkgs/secret-store';

const VAULT_SECRET_NAME = 'EXPO_PUBLIC_SENTRY_DSN';
const DEFAULT_ORG = 'gamezilla';
const DEFAULT_PROJECT = 'react-native';
const SENTRY_API_ORIGIN = 'https://sentry.io';

type CliOptions = {
  org: string;
  project: string;
  force: boolean;
  dryRun: boolean;
  dsn: string | null;
};

type SentryProjectKey = {
  isActive?: boolean;
  dsn?: {
    public?: string;
  };
};

function trimStringOrNull(raw: string | undefined): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parseCliOptions(argv: readonly string[]): CliOptions {
  let org = DEFAULT_ORG;
  let project = DEFAULT_PROJECT;
  let force = false;
  let dryRun = false;
  let dsn: string | null = null;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--force') {
      force = true;
      continue;
    }
    if (arg === '--dry-run') {
      dryRun = true;
      continue;
    }
    if (arg === '--org') {
      const next = argv[i + 1];
      assert.ok(
        typeof next === 'string' && next.length > 0,
        '--org requires a value'
      );
      org = next;
      i += 1;
      continue;
    }
    if (arg === '--project') {
      const next = argv[i + 1];
      assert.ok(
        typeof next === 'string' && next.length > 0,
        '--project requires a value'
      );
      project = next;
      i += 1;
      continue;
    }
    if (arg === '--dsn') {
      const next = argv[i + 1];
      assert.ok(
        typeof next === 'string' && next.length > 0,
        '--dsn requires a value'
      );
      dsn = next.trim();
      i += 1;
    }
  }

  return { org, project, force, dryRun, dsn };
}

function readSentryCliAuthTokenFromRc(): string | null {
  try {
    const text = readFileSync(join(homedir(), '.sentryclirc'), 'utf8');
    const match = text.match(/^\s*token\s*=\s*(\S+)\s*$/m);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

async function resolveSentryAuthToken(store: SecretStore): Promise<string> {
  const fromEnv = trimStringOrNull(process.env['SENTRY_AUTH_TOKEN']);
  if (fromEnv !== null) return fromEnv;

  const fromVault = trimStringOrNull(
    (await store.getOptional('SENTRY_AUTH_TOKEN'))?.readSecretValue()
  );
  if (fromVault !== null) return fromVault;

  const fromRc = readSentryCliAuthTokenFromRc();
  if (fromRc !== null) return fromRc;

  throw new Error(
    'SENTRY_AUTH_TOKEN is missing. Set it in the environment, store it in Vault as ' +
      'SENTRY_AUTH_TOKEN, or log in with `sentry-cli login` (writes ~/.sentryclirc). ' +
      'Create a token at https://sentry.io/settings/account/api/auth-tokens/ ' +
      'with project:read scope.'
  );
}

async function fetchPublicDsnFromSentryApi(args: {
  org: string;
  project: string;
  authToken: string;
}): Promise<string> {
  const url = `${SENTRY_API_ORIGIN}/api/0/projects/${encodeURIComponent(args.org)}/${encodeURIComponent(args.project)}/keys/`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${args.authToken}`,
      Accept: 'application/json',
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `Sentry API GET ${url} failed (${res.status}): ${body.slice(0, 500)}`
    );
  }

  const keys = (await res.json()) as SentryProjectKey[];
  assert.ok(
    Array.isArray(keys) && keys.length > 0,
    'Sentry project has no client keys'
  );

  const preferred =
    keys.find(
      (key) => key.isActive !== false && typeof key.dsn?.public === 'string'
    ) ?? keys.find((key) => typeof key.dsn?.public === 'string');
  const dsn = preferred?.dsn?.public?.trim();
  assert.ok(
    typeof dsn === 'string' && dsn.length > 0,
    'Sentry client key has no public DSN'
  );
  return dsn;
}

function maskDsn(dsn: string): string {
  try {
    const parsed = new URL(dsn);
    const host = parsed.host;
    const path = parsed.pathname.length > 0 ? parsed.pathname : '/…';
    return `${parsed.protocol}//***@${host}${path}`;
  } catch {
    return `${dsn.slice(0, 12)}…`;
  }
}

async function main(): Promise<void> {
  const options = parseCliOptions(process.argv.slice(2));
  const store = createVaultSecretStoreForScripts();

  if (!options.force) {
    const existing = trimStringOrNull(
      (await store.getOptional(VAULT_SECRET_NAME))?.readSecretValue()
    );
    if (existing !== null) {
      process.stdout.write(
        `[setup-sentry-dsn] ${VAULT_SECRET_NAME} already present in Vault; skipping (pass --force to overwrite).\n`
      );
      return;
    }
  }

  const dsn =
    options.dsn ??
    (await fetchPublicDsnFromSentryApi({
      org: options.org,
      project: options.project,
      authToken: await resolveSentryAuthToken(store),
    }));

  if (options.dryRun) {
    process.stdout.write(
      `[setup-sentry-dsn] dry-run: would write ${VAULT_SECRET_NAME}=${maskDsn(dsn)} for ${options.org}/${options.project}\n`
    );
    return;
  }

  await store.setSecret(VAULT_SECRET_NAME, dsn);
  process.stdout.write(
    `[setup-sentry-dsn] wrote ${VAULT_SECRET_NAME} to Vault for ${options.org}/${options.project} (${maskDsn(dsn)}).\n` +
      '[setup-sentry-dsn] Run `bun run --filter @apps/client setup` to refresh .env.local.\n'
  );
}

await main();
