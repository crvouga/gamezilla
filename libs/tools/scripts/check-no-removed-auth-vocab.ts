#!/usr/bin/env bun
/**
 * Fails if better-auth vocabulary remains outside the cutover migration allowlist.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = join(import.meta.dirname, '../../..');
const ALLOWLIST = new Set([
  'libs/runtime/src/server/cutover-legacy-auth-to-idp-migration.ts',
  'libs/secrets/src/scripts/provision-secrets.ts',
  'libs/secrets/src/scripts/seed-auth-secret.ts',
  'libs/tools/scripts/check-no-removed-auth-vocab.ts',
  'libs/tools/biome-plugins/forbid-removed-auth-sdk-imports.grit',
]);

const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  '.turbo',
  'dist',
  'build',
  '.cache',
  'coverage',
  '.wrangler',
  'Pods',
  'ios',
  'android',
]);

const PATTERN =
  /better[_-]?auth|BetterAuth|BETTER_AUTH|@better-auth|auth-better-auth/i;

function* walk(dir: string): Generator<string> {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const name of entries) {
    if (SKIP_DIRS.has(name)) continue;
    const path = join(dir, name);
    let st;
    try {
      st = statSync(path);
    } catch {
      continue;
    }
    if (st.isDirectory()) {
      yield* walk(path);
      continue;
    }
    if (!/\.(ts|tsx|js|cjs|mjs|json|md|grit)$/.test(name)) continue;
    yield path;
  }
}

const hits: string[] = [];
for (const abs of walk(ROOT)) {
  const rel = relative(ROOT, abs).replace(/\\/g, '/');
  if (ALLOWLIST.has(rel)) continue;
  let body: string;
  try {
    body = readFileSync(abs, 'utf8');
  } catch {
    continue;
  }
  if (PATTERN.test(body)) {
    hits.push(rel);
  }
}

if (hits.length > 0) {
  console.error('better-auth vocabulary found outside allowlist:');
  for (const h of hits.slice(0, 50)) console.error(`  ${h}`);
  if (hits.length > 50) console.error(`  …and ${hits.length - 50} more`);
  process.exit(1);
}

console.log('ok: no better-auth vocabulary outside allowlist');
