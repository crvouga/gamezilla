#!/usr/bin/env bun
// @io-wall-ok — composition root
/**
 * Fail if the Lingui catalog is stale vs source macros, or does not compile.
 * (A `t` / `<Trans>` file outside the catalog sources is each package's own
 * `lint`: `lingui-scope.ts`.)
 *
 * Production Lingui looks up a hashed id (`iDNBZe`). A missing catalog key
 * renders that hash instead of English — keep the `.po` in lockstep with the
 * sources. The compiled `messages.ts` is gitignored output of
 * `bun run i18n:compile` (root `postinstall`), so only the `.po` is compared.
 */
import { spawnSync } from 'node:child_process';
import {
  copyFileSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';

const REPO_ROOT = join(import.meta.dirname, '../../..');
const PO_REL = 'libs/app-root-shared-ts/locales/en/messages.po';
/**
 * Scratch catalog the verification regenerates into. The real catalogs are never
 * rewritten: `tc` of every package that imports them runs beside this
 * verification, and a catalog half-written in place fails it ("is not a module").
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
 * The argv that runs one Lingui CLI subcommand (`extract`, `compile`) under
 * this Bun. `lingui extract` dispatches to `dist/lingui-<name>.js` through
 * commander, which on Windows respawns `process.execPath` — `bunx.exe` under
 * `bunx`, which then read the absolute script path as a package spec and tried
 * to `git clone` it. Running the subcommand script directly skips that hop
 * and behaves the same on every OS.
 */
export function linguiCommand(
  bun: string,
  linguiDist: string,
  subcommand: 'extract' | 'compile',
  args: readonly string[]
): { readonly cmd: string; readonly args: readonly string[] } {
  return {
    cmd: bun,
    args: [join(linguiDist, `lingui-${subcommand}.js`), ...args],
  };
}

function linguiDist(): string {
  return dirname(Bun.resolveSync('@lingui/cli', REPO_ROOT));
}

function runLingui(subcommand: 'extract' | 'compile', args: string[]): void {
  const command = linguiCommand(
    process.execPath,
    linguiDist(),
    subcommand,
    args
  );
  run(command.cmd, [...command.args]);
}

const BABEL_CONFIG_RELS = [
  'apps/client-ts/vite.config.mts',
  'pkgs/bun-test-solid-client-ts/src/babel.config.cjs',
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
  writeScratchConfig();
  const config = ['--config', SCRATCH_CONFIG_REL];
  // One process, no worker pool: the pool costs ~2.5x the CPU for a few
  // hundred ms of wall, and under a loaded `bun verify` its workers failed to
  // init ("Did not receive an init message from worker").
  runLingui('extract', ['--clean', '--overwrite', '--workers', '1', ...config]);
  runLingui('compile', ['--typescript', '--strict', ...config]);
  const poAfter = readFileSync(
    join(REPO_ROOT, SCRATCH_REL, 'en/messages.po'),
    'utf8'
  );
  if (poAfter === poBefore) {
    console.log('[ci:i18n] catalog matches source macros');
    return;
  }
  console.error(
    '[ci:i18n] The Lingui catalog is stale. Production shows hashed ids ' +
      '(e.g. "iDNBZe") for any string missing from the catalog.\n' +
      'Run `bun run i18n:extract && bun run i18n:compile` and commit\n' +
      'libs/app-root-shared-ts/locales/en/messages.po'
  );
  process.exit(1);
}

if (import.meta.main) {
  assertDescriptorFieldsKept();
  assertCatalogsFresh();
}
