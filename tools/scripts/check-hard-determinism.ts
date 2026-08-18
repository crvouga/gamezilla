#!/usr/bin/env bun
// @io-wall-ok — tools composition root
/**
 * Hard-determinism gate for game / domain / sync shared paths.
 *
 * Bans locale-dependent APIs and optional/defaulted Io that can leak wall
 * nondeterminism into reduce / merge / mutation logic. See DETERMINISM.md.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const REPO_ROOT = join(import.meta.dirname, '../..');

type Ban = {
  readonly kind: string;
  readonly re: RegExp;
};

const BANS: readonly Ban[] = [
  { kind: 'localeCompare', re: /\.localeCompare\s*\(/ },
  { kind: 'Intl.', re: /\bIntl\./ },
  { kind: 'toLocaleString', re: /\.toLocaleString\s*\(/ },
  { kind: 'optional io?: Io', re: /\bio\?\s*:\s*Io\b/ },
  { kind: 'default io = wallIo', re: /\bio\s*=\s*wallIo\s*\(/ },
];

type Offense = {
  readonly path: string;
  readonly line: number;
  readonly kind: string;
};

function isTestPath(rel: string): boolean {
  return (
    /\.(test|spec|sim\.test)\./.test(rel) ||
    /\/(test|tests|testing|testkit|__tests__)\//.test(rel)
  );
}

function walkTsFiles(dir: string, out: string[]): void {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const name of entries) {
    const abs = join(dir, name);
    let st: ReturnType<typeof statSync>;
    try {
      st = statSync(abs);
    } catch {
      continue;
    }
    if (st.isDirectory()) {
      if (name === 'node_modules' || name === 'dist' || name === '.turbo') {
        continue;
      }
      walkTsFiles(abs, out);
      continue;
    }
    if (name.endsWith('.ts') || name.endsWith('.tsx')) out.push(abs);
  }
}

function collectScanRoots(): string[] {
  const files: string[] = [];
  for (const tier of ['libs', 'pkgs'] as const) {
    const tierRoot = join(REPO_ROOT, tier);
    let pkgs: string[];
    try {
      pkgs = readdirSync(tierRoot);
    } catch {
      continue;
    }
    for (const pkg of pkgs) {
      walkTsFiles(join(tierRoot, pkg, 'src', 'shared'), files);
      const useCasesRoot = join(tierRoot, pkg, 'src', 'use-cases');
      let useCases: string[];
      try {
        useCases = readdirSync(useCasesRoot);
      } catch {
        useCases = [];
      }
      for (const uc of useCases) {
        walkTsFiles(join(useCasesRoot, uc, 'shared'), files);
      }
    }
  }
  walkTsFiles(join(REPO_ROOT, 'pkgs/sync-engine/src/mutations'), files);
  walkTsFiles(join(REPO_ROOT, 'pkgs/sync-engine/src/client'), files);
  walkTsFiles(join(REPO_ROOT, 'pkgs/sync-engine/src/sim'), files);
  walkTsFiles(join(REPO_ROOT, 'pkgs/db-schema/src'), files);
  for (const sub of [
    'client/core',
    'server/core',
    'types.ts',
    'hash-room-state.ts',
  ]) {
    const abs = join(REPO_ROOT, 'pkgs/room/src', sub);
    try {
      if (statSync(abs).isDirectory()) walkTsFiles(abs, files);
      else if (abs.endsWith('.ts')) files.push(abs);
    } catch {
      /* missing ok */
    }
  }
  return [...new Set(files)];
}

function stripLineComment(line: string): string {
  const trimmed = line.trim();
  if (
    trimmed.startsWith('//') ||
    trimmed.startsWith('*') ||
    trimmed.startsWith('/*')
  ) {
    return '';
  }
  const idx = line.indexOf('//');
  if (idx >= 0) return line.slice(0, idx);
  return line;
}

function scanFile(abs: string): Offense[] {
  const rel = relative(REPO_ROOT, abs);
  if (isTestPath(rel)) return [];
  const text = readFileSync(abs, 'utf8');
  const lines = text.split('\n');
  const out: Offense[] = [];
  for (let i = 0; i < lines.length; i++) {
    const code = stripLineComment(lines[i] ?? '');
    if (code.length === 0) continue;
    for (const ban of BANS) {
      if (ban.re.test(code)) {
        out.push({ path: rel, line: i + 1, kind: ban.kind });
      }
    }
  }
  return out;
}

const offenses = collectScanRoots().flatMap(scanFile);
if (offenses.length > 0) {
  console.error('check:hard-determinism FAILED:');
  for (const o of offenses) {
    console.error(`  ${o.path}:${String(o.line)}: ${o.kind}`);
  }
  console.error(
    '\nUse code-unit compares (a < b), required io injection, and no Intl in shared/domain/sync. See DETERMINISM.md.'
  );
  process.exit(1);
}

console.log('check:hard-determinism OK');
