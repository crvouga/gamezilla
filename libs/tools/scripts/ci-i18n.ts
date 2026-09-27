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
import {
  copyFileSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';

const REPO_ROOT = join(import.meta.dirname, '../../..');
const PO_REL = 'libs/client-app/src/i18n/locales/en/messages.po';
const COMPILED_REL = 'libs/client-app/src/i18n/locales/en/messages.ts';
/**
 * Scratch catalog the check regenerates into. The committed catalogs are
 * never rewritten: `tc` of every package that imports them runs beside this
 * check, and a catalog half-written in place fails it ("is not a module").
 */
const SCRATCH_REL = '.cache/ci-i18n';
const SCRATCH_CONFIG_REL = `${SCRATCH_REL}/lingui.config.ts`;
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

/**
 * The root config with its catalog moved into the scratch directory, so
 * extract and compile read the same sources and write nothing committed.
 */
export function scratchConfigSource(repoRoot: string): string {
  return [
    "import base from '../../lingui.config';",
    '',
    'export default {',
    '  ...base,',
    `  rootDir: ${JSON.stringify(repoRoot)},`,
    '  catalogs: base.catalogs?.map((catalog) => ({',
    '    ...catalog,',
    `    path: '<rootDir>/${SCRATCH_REL}/{locale}/messages',`,
    '  })),',
    '};',
    '',
  ].join('\n');
}

function writeScratchConfig(): void {
  const scratch = join(REPO_ROOT, SCRATCH_REL);
  rmSync(scratch, { recursive: true, force: true });
  mkdirSync(join(scratch, 'en'), { recursive: true });
  copyFileSync(join(REPO_ROOT, PO_REL), join(scratch, 'en/messages.po'));
  writeFileSync(
    join(REPO_ROOT, SCRATCH_CONFIG_REL),
    scratchConfigSource(REPO_ROOT)
  );
}

function assertCatalogsFresh(): void {
  const poBefore = readFileSync(join(REPO_ROOT, PO_REL), 'utf8');
  const compiledBefore = readFileSync(join(REPO_ROOT, COMPILED_REL), 'utf8');
  writeScratchConfig();
  const config = ['--config', SCRATCH_CONFIG_REL];
  runWithRetries('bunx', [
    'lingui',
    'extract',
    '--clean',
    '--overwrite',
    ...config,
  ]);
  run('bunx', ['lingui', 'compile', '--typescript', '--strict', ...config]);
  const scratchTs = join(REPO_ROOT, SCRATCH_REL, 'en/messages.ts');
  run('bun', [
    'run',
    'libs/tools/scripts/ensure-trailing-newline.ts',
    scratchTs,
  ]);
  const poAfter = readFileSync(
    join(REPO_ROOT, SCRATCH_REL, 'en/messages.po'),
    'utf8'
  );
  const compiledAfter = readFileSync(scratchTs, 'utf8');
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
