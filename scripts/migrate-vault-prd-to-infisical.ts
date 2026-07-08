#!/usr/bin/env bun
/**
 * One-time (idempotent) backfill: Vault `secret/personal/prd` → Infisical env `prd`.
 *
 * The Vault → Infisical migration populated `dev` only; CI deploy (`env-slug: prd`)
 * OIDC-injects an empty env, then `secrets-run` falls through to interactive
 * `infisical run` after `infra setup` installs the CLI.
 *
 * Requires: logged-in `vault` CLI + `infisical` CLI (see `.infisical.json`).
 *
 * Usage:
 *   bun run scripts/migrate-vault-prd-to-infisical.ts
 *   bun run scripts/migrate-vault-prd-to-infisical.ts --dry-run
 */
import { spawnSync } from 'node:child_process';
import { readSecretsConfig } from '@pkgs/secrets-config/infisical-json';
import { join } from 'node:path';

const REPO_ROOT = join(import.meta.dirname, '..');
const VAULT_PATH = 'secret/personal/prd';

/** Same surface as Infisical `dev` (see `infisical export --env dev`). */
const TARGET_KEYS = [
  'AUTH_PUBLISHABLE_KEY',
  'AUTH_SECRET_KEY',
  'CLERK_PUBLISHABLE_KEY',
  'CLERK_SECRET_KEY',
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
  'TURBO_API',
  'TURBO_CACHE',
  'TURBO_LOG_ORDER',
  'TURBO_TEAM',
  'TURBO_TOKEN',
] as const;

type TargetKey = (typeof TARGET_KEYS)[number];

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

function readVaultPrd(): Record<string, string> {
  const raw = runCapture('vault', ['kv', 'get', '-format=json', VAULT_PATH]);
  const parsed: unknown = JSON.parse(raw);
  if (
    parsed === null ||
    typeof parsed !== 'object' ||
    !('data' in parsed) ||
    typeof (parsed as { data?: unknown }).data !== 'object' ||
    (parsed as { data: { data?: unknown } }).data === null
  ) {
    throw new Error(`Unexpected Vault JSON at ${VAULT_PATH}`);
  }
  const data = (parsed as { data: { data: Record<string, unknown> } }).data
    .data;
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(data)) {
    if (typeof value === 'string' && value.trim().length > 0) {
      out[key] = value;
    }
  }
  return out;
}

function resolveTargetValue(
  vault: Readonly<Record<string, string>>,
  key: TargetKey
): string | undefined {
  const direct = vault[key];
  if (typeof direct === 'string' && direct.trim().length > 0) {
    return direct.trim();
  }
  if (key === 'AUTH_PUBLISHABLE_KEY') {
    return vault['CLERK_PUBLISHABLE_KEY']?.trim();
  }
  if (key === 'AUTH_SECRET_KEY') {
    return vault['CLERK_SECRET_KEY']?.trim();
  }
  if (key === 'CLERK_PUBLISHABLE_KEY') {
    return vault['CLERK_PUBLISHABLE_KEY']?.trim();
  }
  if (key === 'CLERK_SECRET_KEY') {
    return vault['CLERK_SECRET_KEY']?.trim();
  }
  return undefined;
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
    console.log(`[dry-run] would set ${key}`);
    return;
  }
  runCapture('infisical', [
    'secrets',
    'set',
    `${key}=${value}`,
    '--projectId',
    workspaceId,
    '--env',
    env,
    '--domain',
    domain,
  ]);
}

function main(): void {
  const dryRun = process.argv.includes('--dry-run');
  const config = readSecretsConfig(REPO_ROOT);
  const domain = (config.domain ?? 'https://app.infisical.com').replace(
    /\/+$/,
    ''
  );
  const workspaceId = config.workspaceId;

  console.log(
    `[migrate-vault-prd] vault=${VAULT_PATH} → infisical env=prd workspaceId=${workspaceId}`
  );

  const vault = readVaultPrd();
  let set = 0;
  let skipped = 0;

  for (const key of TARGET_KEYS) {
    const value = resolveTargetValue(vault, key);
    if (value === undefined || value.length === 0) {
      console.warn(`[migrate-vault-prd] skip ${key} — no value in Vault prd`);
      skipped += 1;
      continue;
    }
    infisicalSet(workspaceId, 'prd', domain, key, value, dryRun);
    console.log(`[migrate-vault-prd] set ${key}`);
    set += 1;
  }

  console.log(
    `[migrate-vault-prd] done: ${set} set, ${skipped} skipped${dryRun ? ' (dry-run)' : ''}`
  );
  if (set === 0) {
    process.exit(1);
  }
}

main();
