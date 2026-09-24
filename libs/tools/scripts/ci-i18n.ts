#!/usr/bin/env bun
// goal:room-to-grow:6
// @io-wall-ok — composition root
/**
 * Fail if Lingui catalogs are stale vs source macros. (A `t` / `<Trans>` file
 * outside the catalog sources is each package's own `lint`:
 * `lingui-scope.ts`.)
 *
 * Production Lingui looks up a hashed id (`iDNBZe`). A missing catalog key
 * renders that hash instead of English — keep extract/compile in lockstep.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const REPO_ROOT = join(import.meta.dirname, '../../..');
const PO_REL = 'libs/client-app/src/i18n/locales/en/messages.po';
const COMPILED_REL = 'libs/client-app/src/i18n/locales/en/messages.ts';
function run(cmd: string, args: string[]): void {
  const result = spawnSync(cmd, args, {
    cwd: REPO_ROOT,
    stdio: 'inherit',
    env: process.env,
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

/**
 * Lingui extract uses worker threads that occasionally fail to init under
 * heavy turbo concurrency ("Did not receive an init message from worker").
 * Retry a few times before failing the gate.
 */
function runWithRetries(cmd: string, args: string[], attempts = 5): void {
  let lastStatus = 1;
  for (let i = 1; i <= attempts; i++) {
    const result = spawnSync(cmd, args, {
      cwd: REPO_ROOT,
      stdio: 'inherit',
      env: process.env,
    });
    lastStatus = result.status ?? 1;
    if (lastStatus === 0) return;
    if (i < attempts) {
      const backoffMs = 2000 * i;
      console.error(
        `[ci:i18n] ${cmd} ${args.join(' ')} failed (attempt ${String(i)}/${String(attempts)}); retrying in ${String(backoffMs)}ms…`
      );
      Bun.sleepSync(backoffMs);
    }
  }
  process.exit(lastStatus);
}

const BABEL_CONFIG_RELS = [
  'apps/client/vite.config.mts',
  'pkgs/bun-test-solid/src/babel.config.cjs',
] as const;

function assertDescriptorFieldsKept(): void {
  for (const rel of BABEL_CONFIG_RELS) {
    const text = readFileSync(join(REPO_ROOT, rel), 'utf8');
    if (text.includes("descriptorFields: 'all'")) continue;
    console.error(
      `[ci:i18n] ${rel} must pass descriptorFields: 'all' to ` +
        `@lingui/babel-plugin-lingui-macro. Production otherwise strips ` +
        `source text and missing catalog keys render hashed ids.`
    );
    process.exit(1);
  }
}

function assertCatalogsFresh(): void {
  const poBefore = readFileSync(join(REPO_ROOT, PO_REL), 'utf8');
  const compiledBefore = readFileSync(join(REPO_ROOT, COMPILED_REL), 'utf8');
  runWithRetries('bun', ['run', 'i18n:extract']);
  run('bun', ['run', 'i18n:compile']);
  const poAfter = readFileSync(join(REPO_ROOT, PO_REL), 'utf8');
  const compiledAfter = readFileSync(join(REPO_ROOT, COMPILED_REL), 'utf8');
  if (poAfter === poBefore && compiledAfter === compiledBefore) {
    console.log('[ci:i18n] catalogs match source macros');
    return;
  }
  console.error(
    '[ci:i18n] Lingui catalogs are stale. Production shows hashed ids ' +
      '(e.g. "iDNBZe") for any string missing from the catalog.\n' +
      'Run `bun run i18n:extract && bun run i18n:compile` and commit\n' +
      'libs/client-app/src/i18n/locales/en/messages.{po,ts}'
  );
  process.exit(1);
}

if (import.meta.main) {
  assertDescriptorFieldsKept();
  assertCatalogsFresh();
}
