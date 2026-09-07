#!/usr/bin/env bun
// @io-wall-ok — tools composition root
/**
 * Fail if Lingui catalogs are stale vs source macros, or if a `t` / `<Trans>`
 * file sits outside `lingui.config.ts` `catalogs.include`.
 *
 * Production Lingui looks up a hashed id (`iDNBZe`). A missing catalog key
 * renders that hash instead of English — keep extract/compile in lockstep.
 */
import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const REPO_ROOT = join(import.meta.dirname, '../..');
const PO_REL = 'apps/client/src/i18n/locales/en/messages.po';
const COMPILED_REL = 'apps/client/src/i18n/locales/en/messages.ts';
const MACRO_FROM = /from\s+['"]@lingui\/(?:core|solid)\/macro['"]/;
const SCAN_ROOTS = ['apps', 'libs', 'pkgs'] as const;
const SKIP_DIR_NAMES = new Set([
  'node_modules',
  'dist',
  '.turbo',
  '.git',
  'coverage',
  'ios',
  'android',
  'Pods',
  'generated',
]);

export type LinguiCatalogConfig = {
  catalogs?: Array<{ include?: unknown }>;
};

export function catalogIncludeRelPaths(config: LinguiCatalogConfig): string[] {
  const catalogs = config.catalogs;
  if (catalogs === undefined) return [];
  const out: string[] = [];
  for (const catalog of catalogs) {
    const include = catalog.include;
    if (!Array.isArray(include)) continue;
    for (const entry of include) {
      if (typeof entry !== 'string') continue;
      out.push(entry.replace(/^<rootDir>\//, ''));
    }
  }
  return out;
}

export function posixUnderInclude(
  relFile: string,
  includes: readonly string[]
): boolean {
  const file = relFile.split(sep).join('/');
  return includes.some((inc) => {
    const prefix = inc.endsWith('/') ? inc : `${inc}/`;
    return file === inc || file.startsWith(prefix);
  });
}

function isSkippedDir(name: string): boolean {
  return SKIP_DIR_NAMES.has(name);
}

function walkTsFiles(absDir: string, files: string[]): void {
  let entries;
  try {
    entries = readdirSync(absDir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (entry.isSymbolicLink()) continue;
    const name = entry.name;
    if (entry.isDirectory()) {
      if (isSkippedDir(name)) continue;
      walkTsFiles(join(absDir, name), files);
      continue;
    }
    if (!entry.isFile()) continue;
    if (name.endsWith('.ts') || name.endsWith('.tsx')) {
      files.push(join(absDir, name));
    }
  }
}

export function listLinguiMacroRelFiles(repoRoot: string): string[] {
  const absFiles: string[] = [];
  for (const root of SCAN_ROOTS) {
    walkTsFiles(join(repoRoot, root), absFiles);
  }
  const rel: string[] = [];
  for (const abs of absFiles) {
    const text = readFileSync(abs, 'utf8');
    if (!MACRO_FROM.test(text)) continue;
    rel.push(relative(repoRoot, abs).split(sep).join('/'));
  }
  rel.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  return rel;
}

export function macrosOutsideCatalogInclude(
  relFiles: readonly string[],
  includes: readonly string[]
): string[] {
  return relFiles.filter((file) => !posixUnderInclude(file, includes));
}

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

async function loadLinguiConfig(): Promise<LinguiCatalogConfig> {
  const mod = (await import(join(REPO_ROOT, 'lingui.config.ts'))) as {
    default: LinguiCatalogConfig;
  };
  return mod.default;
}

const BABEL_CONFIG_RELS = [
  'apps/client/vite.config.mts',
  'apps/product/babel.test.config.cjs',
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

async function assertMacrosCovered(): Promise<void> {
  const includes = catalogIncludeRelPaths(await loadLinguiConfig());
  const outside = macrosOutsideCatalogInclude(
    listLinguiMacroRelFiles(REPO_ROOT),
    includes
  );
  if (outside.length === 0) return;
  console.error(
    '[ci:i18n] Lingui macro files are outside catalogs.include.\n' +
      'Add the package src dir to lingui.config.ts or they will render hashed ids in production:\n' +
      outside.map((file) => `  ${file}`).join('\n')
  );
  process.exit(1);
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
      'apps/client/src/i18n/locales/en/messages.{po,ts}'
  );
  process.exit(1);
}

if (import.meta.main) {
  assertDescriptorFieldsKept();
  await assertMacrosCovered();
  assertCatalogsFresh();
}
