// @io-wall-ok — tools composition root
/**
 * Ensures `@pkgs/pubsub-emqx` is only imported from composition roots.
 *
 * Allowlist:
 * - pkgs/pubsub-emqx/**
 * - apps/server/src/sync/**
 * - apps/client/src/sync/**
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = join(import.meta.dir, '../../..');

const ALLOW_PREFIXES = [
  'pkgs/pubsub-emqx/',
  'apps/server/src/sync/',
  'apps/client/src/sync/',
];

const IMPORT_RE =
  /from\s+['"]@pkgs\/pubsub-emqx(?:\/[^'"]*)?['"]|require\(\s*['"]@pkgs\/pubsub-emqx/;

function walk(dir: string, out: string[]): void {
  for (const name of readdirSync(dir)) {
    if (
      name === 'node_modules' ||
      name === 'dist' ||
      name === '.git' ||
      name === '.turbo' ||
      name === 'coverage'
    ) {
      continue;
    }
    const path = join(dir, name);
    const st = statSync(path);
    if (st.isDirectory()) {
      walk(path, out);
      continue;
    }
    if (!/\.(ts|tsx|js|jsx|mjs|cjs)$/.test(name)) continue;
    out.push(path);
  }
}

function isAllowed(rel: string): boolean {
  return ALLOW_PREFIXES.some((prefix) => rel.startsWith(prefix));
}

const files: string[] = [];
for (const root of ['apps', 'libs', 'pkgs', 'tools']) {
  const abs = join(ROOT, root);
  try {
    walk(abs, files);
  } catch {
    // missing tier dir
  }
}

const offenders: string[] = [];
for (const file of files) {
  const rel = relative(ROOT, file);
  if (isAllowed(rel)) continue;
  const text = readFileSync(file, 'utf8');
  if (IMPORT_RE.test(text)) offenders.push(rel);
}

if (offenders.length > 0) {
  console.error(
    '@pkgs/pubsub-emqx imports must stay in composition roots:\n' +
      offenders.map((f) => `  - ${f}`).join('\n')
  );
  process.exit(1);
}

console.log('check-pubsub-emqx-imports: ok');
