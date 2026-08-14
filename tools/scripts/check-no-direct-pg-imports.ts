#!/usr/bin/env bun
// @io-wall-ok — tools composition root

/**
 * Fail-fast guardrail: only `@pkgs/sql-client` may open `node-postgres`
 * connections.
 *
 * Every Postgres connection in this repo must go through the schema-aware
 * factories in `pkgs/sql-client/src/postgres/connect.ts` (`openPgClient`,
 * `createPgPool`, …), which pin the session `search_path` to the canonical
 * `public` schema. A raw `new Client()` / `new Pool()` anywhere else would
 * silently fall back to whatever the server's default schema is — defeating
 * the guarantee that the app only ever touches its own schema.
 *
 * This check bans VALUE imports of `pg` (the ones that can actually open a
 * connection) outside `pkgs/sql-client/src/**`. Type-only imports
 * (`import type { Pool } from 'pg'`) are allowed everywhere: they are erased at
 * runtime and cannot open a connection — they only type a `Pool` that was
 * created by the factories and handed in. Route those through
 * `@pkgs/sql-client/postgres/pg-types` when convenient.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const REPO_ROOT = join(import.meta.dirname, '../..');
const SCAN_DIRS = ['apps', 'libs', 'pkgs'];
const ALLOWED_PREFIX = join('pkgs', 'sql-client', 'src');
const SKIP_DIR = new Set(['node_modules', 'dist', '.turbo', 'coverage']);

type Violation = { file: string; statement: string };

/** Value imports / requires of the exact module `pg` (not `pg-*`). */
const VALUE_IMPORT_PATTERNS: readonly RegExp[] = [
  // `import ... from 'pg'` that is NOT `import type ... from 'pg'`.
  // `[^;]*?` keeps each match within a single (semicolon-terminated) statement
  // so a preceding value import can't be glued to a later `import type` of pg.
  /\bimport\s+(?!type\b)[^;]*?\bfrom\s*['"]pg['"]/g,
  // Side-effect import `import 'pg'`.
  /\bimport\s*['"]pg['"]/g,
  // `require('pg')` and dynamic `import('pg')`.
  /(?:require|import)\s*\(\s*['"]pg['"]\s*\)/g,
];

function walk(dir: string, files: string[]): void {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIP_DIR.has(entry.name)) continue;
      walk(join(dir, entry.name), files);
    } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
      files.push(join(dir, entry.name));
    }
  }
}

function findViolations(): Violation[] {
  const violations: Violation[] = [];
  for (const scanDir of SCAN_DIRS) {
    const absScanDir = join(REPO_ROOT, scanDir);
    try {
      if (!statSync(absScanDir).isDirectory()) continue;
    } catch {
      continue;
    }
    const files: string[] = [];
    walk(absScanDir, files);
    for (const file of files) {
      const rel = relative(REPO_ROOT, file);
      if (rel.startsWith(ALLOWED_PREFIX)) continue;
      const content = readFileSync(file, 'utf8');
      for (const pattern of VALUE_IMPORT_PATTERNS) {
        for (const match of content.matchAll(pattern)) {
          violations.push({
            file: rel,
            statement: match[0].replace(/\s+/g, ' ').trim(),
          });
        }
      }
    }
  }
  return violations;
}

const violations = findViolations();
if (violations.length === 0) {
  console.log(
    'check:no-direct-pg-imports OK — pg connections only open via @pkgs/sql-client.'
  );
  process.exit(0);
}

console.error(
  'check:no-direct-pg-imports FAILED — value imports of `pg` are only allowed in pkgs/sql-client/src/**.'
);
for (const v of violations) {
  console.error(`  - ${v.file}: ${v.statement}`);
}
console.error(
  '\nOpen connections via @pkgs/sql-client (`openPgClient` / `createPgPool`), which pin the `public` schema. For pg types, import from `@pkgs/sql-client/postgres/pg-types`.'
);
process.exit(1);
