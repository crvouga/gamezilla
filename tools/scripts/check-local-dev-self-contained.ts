/**
 * Regression guard: `setup-dev-vars` with no Infisical / cloud feature secrets
 * must succeed and force loopback Postgres, MinIO, and EMQX.
 */

import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  DEV_VARS_PATH,
  decodeDevVarValue,
} from '../../apps/api/scripts/dev-vars';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../..');
const backupPath = `${DEV_VARS_PATH}.self-contained-check.bak`;

const REQUIRED_LOOPBACK: Readonly<Record<string, string>> = {
  DATABASE_URL:
    'postgresql://postgres:postgres@127.0.0.1:15432/local?sslmode=disable',
  S3_ENDPOINT: 'http://127.0.0.1:9000',
  S3_BUCKET: 'local',
  B2_APP_KEY_ID: 'minioadmin',
  B2_APP_KEY: 'minioadmin',
  EMQX_API_URL: 'http://127.0.0.1:18083',
  EMQX_WSS_URL: 'ws://127.0.0.1:8083/mqtt',
  EMQX_API_KEY: 'pubsub-test',
  EMQX_API_SECRET: 'pubsub-test-secret',
};

const MUST_ABSENT = [
  'WEB_CLIENT_GOOGLE_CLIENT_ID',
  'WEB_CLIENT_GOOGLE_CLIENT_SECRET',
  'STRIPE_SECRET_KEY',
  'ELEVEN_LABS_API_KEY',
  'OPENAI_API_KEY',
  'OPENAI_BASE_URL',
  'CLOUDFLARE_API_TOKEN',
  'EXPO_TOKEN',
  'TURBO_TOKEN',
  'B2_MASTER_KEY',
] as const;

function parseDevVars(content: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.length === 0 || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq);
    out.set(key, decodeDevVarValue(trimmed.slice(eq + 1)));
  }
  return out;
}

function restoreBackup(): void {
  if (existsSync(backupPath)) {
    copyFileSync(backupPath, DEV_VARS_PATH);
    rmSync(backupPath);
  }
}

function main(): void {
  if (existsSync(DEV_VARS_PATH)) {
    copyFileSync(DEV_VARS_PATH, backupPath);
  }

  const result = spawnSync(
    'bun',
    ['run', 'apps/api/scripts/setup-dev-vars.ts'],
    {
      cwd: repoRoot,
      env: {
        ...process.env,
        SECRETS_ENV: 'dev',
        LOCAL_SECRETS: '1',
        // Strip optional cloud overlays so the offline path is deterministic.
        WEB_CLIENT_GOOGLE_CLIENT_ID: '',
        WEB_CLIENT_GOOGLE_CLIENT_SECRET: '',
        STRIPE_SECRET_KEY: '',
        ELEVEN_LABS_API_KEY: '',
        OPENAI_API_KEY: '',
        OPENAI_BASE_URL: '',
        CLOUDFLARE_API_TOKEN: '',
        EXPO_TOKEN: '',
        TURBO_TOKEN: '',
        B2_MASTER_KEY: '',
        BETTER_AUTH_SECRET: '',
      },
      encoding: 'utf8',
    }
  );

  try {
    if (result.status !== 0) {
      console.error(result.stdout);
      console.error(result.stderr);
      throw new Error(
        `setup-dev-vars failed with status ${String(result.status)}`
      );
    }
    if (!existsSync(DEV_VARS_PATH)) {
      throw new Error('setup-dev-vars did not write .dev.vars');
    }
    const vars = parseDevVars(readFileSync(DEV_VARS_PATH, 'utf8'));

    for (const [key, expected] of Object.entries(REQUIRED_LOOPBACK)) {
      const actual = vars.get(key);
      if (actual !== expected) {
        throw new Error(
          `expected ${key}=${expected}, got ${JSON.stringify(actual)}`
        );
      }
    }

    const betterAuth = vars.get('BETTER_AUTH_SECRET') ?? '';
    if (betterAuth.length < 32) {
      throw new Error('BETTER_AUTH_SECRET missing or too short');
    }

    for (const key of MUST_ABSENT) {
      if (vars.has(key)) {
        throw new Error(
          `${key} must be absent when LOCAL_SECRETS=1 (got ${JSON.stringify(vars.get(key))})`
        );
      }
    }

    console.log(
      'ci:local-dev-self-contained: setup-dev-vars offline path OK (loopback Postgres/MinIO/EMQX; optional clouds absent).'
    );
  } finally {
    restoreBackup();
  }
}

try {
  main();
} catch (error) {
  restoreBackup();
  console.error(
    `ci:local-dev-self-contained: ${error instanceof Error ? error.message : String(error)}`
  );
  process.exit(1);
}
