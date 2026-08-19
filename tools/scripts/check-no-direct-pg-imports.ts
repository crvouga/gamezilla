#!/usr/bin/env bun
// @io-wall-ok — tools composition root

/**
 * Fail-fast: `node-postgres` (`pg`) may only be value-imported from wall TCP
 * openers. Type re-exports / `import type from 'pg'` are also banned —
 * Metro follows those into the Expo web graph and loads real `pg` (which
 * crashes on missing `util.deprecate`).
 *
 * Connections: `pkgs/sql-client/src/postgres/connect.ts` (`openPgClient`,
 * `createPgPool`, …). Types: hand-written `@pkgs/sql-client/postgres/pg-types`.
 * Schema ensure for migrate/sims: `@pkgs/sql-client/postgres/ensure-schema`
 * (isomorphic — never import `connect` from Expo / playground migrate).
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const REPO_ROOT = join(import.meta.dirname, '../..');
const SCAN_DIRS = ['apps', 'libs', 'pkgs', 'tools'];
/** Absolute-relative paths allowed to mention module specifier `pg`. */
const ALLOWED_PG_FILES = new Set([
  join('pkgs', 'sql-client', 'src', 'postgres', 'connect.ts'),
  join('pkgs', 'sql-client', 'src', 'postgres', 'ping.ts'),
]);
/**
 * Composition roots that may import wall TCP openers
 * (`@pkgs/sql-client/postgres/connect` / `ping`). Expo client, isomorphic
 * migrate, and db-migrate must use `ensure-schema` / injected OpenRequestDb /
 * pg-mem instead.
 */
const ALLOWED_CONNECT_IMPORT_FILES = new Set([
  join('apps', 'api', 'src', 'db', 'migrate.ts'),
  join('apps', 'api', 'src', 'db', 'open-request-db-postgres.ts'),
  join('apps', 'api', 'scripts', 'wipe-dev-db.ts'),
  join('apps', 'api', 'scripts', 'run-local-postgres-migrate.ts'),
  join('apps', 'api', 'scripts', 'run-local-postgres-seed.ts'),
  join('apps', 'postgres', 'scripts', 'migrate.ts'),
  join('apps', 'postgres', 'scripts', 'seed.ts'),
  join(
    'libs',
    'chess',
    'src',
    'root',
    'server',
    'seed-chess-puzzles',
    'chess-puzzle-seeder.ts'
  ),
  join(
    'libs',
    'chess',
    'src',
    'root',
    'server',
    'seed-chess-puzzles',
    'export-chess-puzzles-load.ts'
  ),
  join('libs', 'stripe', 'src', 'shared', 'stripe', 'script-runtime.ts'),
  join('libs', 'infra', 'src', 'cli', 'secrets', 'db-url.ts'),
  join('tools', 'scripts', 'run-postgres-migrations-secrets.ts'),
]);
const SKIP_DIR = new Set(['node_modules', 'dist', '.turbo', 'coverage']);

type Violation = { file: string; statement: string };

/** Any import / require / re-export of the exact module `pg` (not `pg-*`). */
const PG_MODULE_PATTERNS: readonly RegExp[] = [
  // `import … from 'pg'` including `import type`.
  /\bimport\s+[^;]*?\bfrom\s*['"]pg['"]/g,
  // Side-effect `import 'pg'`.
  /\bimport\s*['"]pg['"]/g,
  // `export … from 'pg'` including `export type { … } from 'pg'`.
  /\bexport\s+[^;]*?\bfrom\s*['"]pg['"]/g,
  // `require('pg')` / dynamic `import('pg')`.
  /(?:require|import)\s*\(\s*['"]pg['"]\s*\)/g,
];

/** Package imports of wall TCP openers (relative `./connect` stays inside sql-client). */
const CONNECT_IMPORT_PATTERNS: readonly RegExp[] = [
  /\bfrom\s*['"]@pkgs\/sql-client\/postgres\/(?:connect|ping)['"]/g,
  /(?:require|import)\s*\(\s*['"]@pkgs\/sql-client\/postgres\/(?:connect|ping)['"]\s*\)/g,
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
      // This script itself documents the ban patterns.
      if (rel === join('tools', 'scripts', 'check-no-direct-pg-imports.ts')) {
        continue;
      }
      const content = readFileSync(file, 'utf8');
      if (!ALLOWED_PG_FILES.has(rel)) {
        for (const pattern of PG_MODULE_PATTERNS) {
          for (const match of content.matchAll(pattern)) {
            violations.push({
              file: rel,
              statement: match[0].replace(/\s+/g, ' ').trim(),
            });
          }
        }
      }
      if (!ALLOWED_CONNECT_IMPORT_FILES.has(rel)) {
        for (const pattern of CONNECT_IMPORT_PATTERNS) {
          for (const match of content.matchAll(pattern)) {
            violations.push({
              file: rel,
              statement: match[0].replace(/\s+/g, ' ').trim(),
            });
          }
        }
      }
    }
  }
  return violations;
}

const violations = findViolations();
if (violations.length === 0) {
  console.log(
    'check:no-direct-pg-imports OK — `pg` / postgres/connect|ping only in wall openers; types via pg-types; schema ensure via ensure-schema.'
  );
  process.exit(0);
}

console.error(
  'check:no-direct-pg-imports FAILED — `pg` and `@pkgs/sql-client/postgres/connect|ping` are wall-only.'
);
for (const v of violations) {
  console.error(`  - ${v.file}: ${v.statement}`);
}
console.error(
  '\nOpen TCP via `@pkgs/sql-client/postgres/connect` only from allowlisted scripts/API openers. For Pool/Client types use `@pkgs/sql-client/postgres/pg-types`. For migrate/sims schema ensure use `@pkgs/sql-client/postgres/ensure-schema` (never `connect` — Metro would load real `pg`).'
);
process.exit(1);
