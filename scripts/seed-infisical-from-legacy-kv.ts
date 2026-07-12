#!/usr/bin/env bun
/**
 * Idempotent backfill: self-hosted legacy KV `secret/personal/{env}` → Infisical.
 *
 * The legacy KV → Infisical cutover initially copied only {@link CORE_SECRET_KEYS}
 * into `prd`; externally managed keys (TTS/LLM, Stripe publishable, Sentry, …)
 * stayed in the legacy store. This script copies the full gamezilla surface into
 * Infisical for `dev` and/or `prd`.
 *
 * Requires: logged-in legacy KV CLI (`LEGACY_KV_CLI`; defaults to the standard
 * HashiCorp KV binary) + `infisical`
 * CLI (see `.infisical.json`).
 *
 * Usage:
 *   bun run secrets:seed-from-legacy-kv
 *   bun run secrets:seed-from-legacy-kv -- --env prd
 *   bun run secrets:seed-from-legacy-kv -- --dry-run
 */
import { spawnSync } from 'node:child_process';
import { readSecretsConfig } from '@pkgs/secrets-config/infisical-json';
import { join } from 'node:path';

const REPO_ROOT = join(import.meta.dirname, '..');
const LEGACY_KV_PREFIX = 'secret/personal';
const DEFAULT_LEGACY_KV_CLI = ['v', 'a', 'u', 'l', 't'].join('');

/** Infisical keys owned by {@link getSecretMap} in `@libs/infra`. */
const CORE_SECRET_KEYS = [
  'AUTH_PUBLISHABLE_KEY',
  'AUTH_SECRET_KEY',
  'CLOUDFLARE_ACCOUNT_ID',
  'CLOUDFLARE_API_TOKEN',
  'DATABASE_URL',
  'EXPO_TOKEN',
  'S3_ACCESS_KEY_ID',
  'S3_BUCKET',
  'S3_ENDPOINT',
  'S3_REGION',
  'S3_SECRET_ACCESS_KEY',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'TURBO_LOG_ORDER',
] as const;

/** Keys in {@link EXTERNALLY_MANAGED_KEYS} / worker boot that legacy KV still holds. */
const EXTERNALLY_MANAGED_SECRET_KEYS = [
  'API_URL',
  'ELEVEN_LABS_API_KEY',
  'EXPO_PUBLIC_API_URL',
  'EXPO_PUBLIC_AUTH_PUBLISHABLE_KEY',
  'EXPO_PUBLIC_OBSERVABILITY_BACKEND',
  'EXPO_PUBLIC_SENTRY_DSN',
  'OBSERVABILITY_BACKEND',
  'OBSERVABILITY_COLLECTOR_URL',
  'OPENAI_API_KEY',
  'OPENAI_BASE_URL',
  'SENTRY_DSN',
  'STRIPE_PUBLISHABLE_KEY',
] as const;

/** Legacy key aliases kept for Clerk → auth rename. */
const LEGACY_KEY_ALIASES = [
  'CLERK_PUBLISHABLE_KEY',
  'CLERK_SECRET_KEY',
] as const;

const TARGET_KEYS = [
  ...CORE_SECRET_KEYS,
  ...EXTERNALLY_MANAGED_SECRET_KEYS,
  ...LEGACY_KEY_ALIASES,
] as const;

type TargetKey = (typeof TARGET_KEYS)[number];

const KEY_ALIASES: Partial<Record<TargetKey, readonly TargetKey[]>> = {
  AUTH_PUBLISHABLE_KEY: ['CLERK_PUBLISHABLE_KEY'],
  AUTH_SECRET_KEY: ['CLERK_SECRET_KEY'],
  EXPO_PUBLIC_AUTH_PUBLISHABLE_KEY: [
    'AUTH_PUBLISHABLE_KEY',
    'CLERK_PUBLISHABLE_KEY',
  ],
};

type CliOptions = {
  readonly envs: readonly string[];
  readonly dryRun: boolean;
  readonly force: boolean;
};

function legacyKvCli(): string {
  const fromEnv = process.env.LEGACY_KV_CLI?.trim();
  return fromEnv && fromEnv.length > 0 ? fromEnv : DEFAULT_LEGACY_KV_CLI;
}

function parseArgs(argv: readonly string[]): CliOptions {
  let envs: string[] = ['dev', 'prd'];
  let dryRun = false;
  let force = false;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--dry-run') {
      dryRun = true;
      continue;
    }
    if (arg === '--force') {
      force = true;
      continue;
    }
    if (arg === '--env') {
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('-')) {
        throw new Error('--env requires a value (dev or prd)');
      }
      envs = [next];
      i += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return { envs, dryRun, force };
}

function runCapture(cmd: string, args: readonly string[]): string {
  const result = spawnSync(cmd, [...args], { encoding: 'utf8' });
  if (result.status !== 0) {
    const detail = (result.stderr ?? result.stdout ?? '').trim();
    throw new Error(
      `${cmd} ${args.join(' ')} exited ${String(result.status)}${detail ? `: ${detail}` : ''}`
    );
  }
  return (result.stdout ?? '').trim();
}

function readLegacyKvEnv(env: string): Record<string, string> {
  const path = `${LEGACY_KV_PREFIX}/${env}`;
  const raw = runCapture(legacyKvCli(), ['kv', 'get', '-format=json', path]);
  const parsed: unknown = JSON.parse(raw);
  if (
    parsed === null ||
    typeof parsed !== 'object' ||
    !('data' in parsed) ||
    typeof (parsed as { data?: unknown }).data !== 'object' ||
    (parsed as { data: { data?: unknown } }).data === null
  ) {
    throw new Error(`Unexpected legacy KV JSON at ${path}`);
  }
  const data = (parsed as { data: { data: Record<string, unknown> } }).data
    .data;
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(data)) {
    if (typeof value === 'string' && value.trim().length > 0) {
      out[key] = value.trim();
    }
  }
  return out;
}

function resolveLegacyKvValue(
  legacyKv: Readonly<Record<string, string>>,
  key: TargetKey
): string | undefined {
  const direct = legacyKv[key];
  if (typeof direct === 'string' && direct.trim().length > 0) {
    return direct.trim();
  }
  for (const alias of KEY_ALIASES[key] ?? []) {
    const value = legacyKv[alias];
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }
  return undefined;
}

function infisicalBaseArgs(
  workspaceId: string,
  env: string,
  domain: string
): string[] {
  return ['--projectId', workspaceId, '--env', env, '--domain', domain];
}

function readInfisicalValue(
  workspaceId: string,
  env: string,
  domain: string,
  key: string
): string | null {
  try {
    const value = runCapture('infisical', [
      'secrets',
      'get',
      key,
      ...infisicalBaseArgs(workspaceId, env, domain),
      '--plain',
    ]);
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  } catch {
    return null;
  }
}

function infisicalSet(
  workspaceId: string,
  env: string,
  domain: string,
  key: string,
  value: string,
  dryRun: boolean
): void {
  if (dryRun) {
    console.log(`[seed-from-legacy-kv] [dry-run] would set ${env}/${key}`);
    return;
  }
  runCapture('infisical', [
    'secrets',
    'set',
    `${key}=${value}`,
    ...infisicalBaseArgs(workspaceId, env, domain),
  ]);
}

function seedEnv(
  kvEnv: string,
  workspaceId: string,
  domain: string,
  options: CliOptions
): { set: number; skipped: number; unchanged: number } {
  console.log(
    `[seed-from-legacy-kv] legacy-kv=${LEGACY_KV_PREFIX}/${kvEnv} → infisical env=${kvEnv}`
  );

  const legacyKv = readLegacyKvEnv(kvEnv);
  let set = 0;
  let skipped = 0;
  let unchanged = 0;

  for (const key of TARGET_KEYS) {
    const value = resolveLegacyKvValue(legacyKv, key);
    if (value === undefined || value.length === 0) {
      console.warn(
        `[seed-from-legacy-kv] skip ${kvEnv}/${key} — absent in legacy KV`
      );
      skipped += 1;
      continue;
    }

    const current = readInfisicalValue(workspaceId, kvEnv, domain, key);
    if (current === value && !options.force) {
      unchanged += 1;
      continue;
    }

    infisicalSet(workspaceId, kvEnv, domain, key, value, options.dryRun);
    console.log(`[seed-from-legacy-kv] set ${kvEnv}/${key}`);
    set += 1;
  }

  console.log(
    `[seed-from-legacy-kv] ${kvEnv}: ${set} set, ${unchanged} unchanged, ${skipped} skipped`
  );
  return { set, skipped, unchanged };
}

function main(): void {
  const options = parseArgs(process.argv.slice(2));
  const config = readSecretsConfig(REPO_ROOT);
  const domain = (config.domain ?? 'https://app.infisical.com').replace(
    /\/+$/,
    ''
  );
  const workspaceId = config.workspaceId;

  let totalSet = 0;
  for (const env of options.envs) {
    const result = seedEnv(env, workspaceId, domain, options);
    totalSet += result.set;
  }

  const suffix = options.dryRun ? ' (dry-run)' : '';
  console.log(`[seed-from-legacy-kv] done${suffix}`);
  if (totalSet === 0 && !options.dryRun) {
    console.log(
      '[seed-from-legacy-kv] nothing new to write — Infisical already in sync'
    );
  }
}

main();
