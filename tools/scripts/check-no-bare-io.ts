/**
 * Fails when product client code uses bare I/O (fetch, crypto.randomUUID,
 * Math.random) instead of injected @pkgs/http-client / @pkgs/uuid ports.
 *
 * Scans each libs package client tree and apps/client/src.
 * Allowlist adapters, polyfills, tests, and wall implementations.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const REPO_ROOT = join(import.meta.dirname, '../..');

const SCAN_ROOTS = [
  join(REPO_ROOT, 'libs'),
  join(REPO_ROOT, 'apps/client/src'),
] as const;

const SKIP_DIR = new Set([
  'node_modules',
  'dist',
  '.git',
  '.turbo',
  'coverage',
  '.expo',
  '.wrangler',
  'ios',
  'android',
  'server',
  'shared',
  'scripts',
]);

/** Paths relative to repo root that may still touch bare I/O. */
const ALLOW_FILE_PREFIXES = [
  'pkgs/clock/',
  'pkgs/http-client/',
  'pkgs/uuid/src/create-id.ts',
  'apps/client/src/polyfill-entry.ts',
  'apps/client/src/providers/infrastructure/app-io-provider.tsx',
];

const ALLOW_FILE_SUFFIXES = ['.test.ts', '.test.tsx', '.spec.ts', '.spec.tsx'];

const BARE_FETCH_RE = /(?:^|[^.\w])fetch\s*\(/;
const GLOBAL_FETCH_RE = /globalThis\.fetch/;
const CRYPTO_UUID_RE = /crypto\.randomUUID\s*\(/;
const MATH_RANDOM_RE = /Math\.random\s*\(/;

function walk(dir: string, out: string[]): void {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const abs = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIR.has(entry.name)) continue;
      // Only scan client/ under libs packages
      if (dir === join(REPO_ROOT, 'libs')) {
        const clientDir = join(abs, 'src', 'client');
        try {
          if (statSync(clientDir).isDirectory()) walk(clientDir, out);
        } catch {
          // no client folder
        }
        continue;
      }
      walk(abs, out);
      continue;
    }
    if (!entry.isFile()) continue;
    if (!/\.(ts|tsx)$/.test(entry.name)) continue;
    out.push(abs);
  }
}

function isAllowed(rel: string): boolean {
  if (ALLOW_FILE_PREFIXES.some((p) => rel.startsWith(p) || rel === p)) {
    return true;
  }
  if (ALLOW_FILE_SUFFIXES.some((s) => rel.endsWith(s))) return true;
  return false;
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

type Offense = {
  readonly rel: string;
  readonly kind: string;
  readonly line: number;
};

const files: string[] = [];
for (const root of SCAN_ROOTS) {
  walk(root, files);
}

const offenses: Offense[] = [];

for (const file of files) {
  const rel = relative(REPO_ROOT, file);
  if (isAllowed(rel)) continue;
  // libs walk already scoped to client/; skip non-client under apps if any
  if (rel.startsWith('libs/') && !rel.includes('/src/client/')) continue;

  const text = readFileSync(file, 'utf8');
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const code = stripLineComment(lines[i] ?? '');
    if (code.length === 0) continue;
    if (BARE_FETCH_RE.test(code) || GLOBAL_FETCH_RE.test(code)) {
      offenses.push({ rel, kind: 'bare fetch', line: i + 1 });
    }
    if (CRYPTO_UUID_RE.test(code)) {
      offenses.push({ rel, kind: 'crypto.randomUUID', line: i + 1 });
    }
    if (MATH_RANDOM_RE.test(code)) {
      offenses.push({ rel, kind: 'Math.random', line: i + 1 });
    }
  }
}

if (offenses.length > 0) {
  console.error(
    'Bare I/O check failed — use @pkgs/http-client / @pkgs/uuid ports:\n'
  );
  for (const o of offenses) {
    console.error(`  - ${o.rel}:${String(o.line)} (${o.kind})`);
  }
  process.exit(1);
}

console.log(`Bare I/O check passed (${String(files.length)} files scanned).`);
