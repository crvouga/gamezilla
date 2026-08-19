#!/usr/bin/env bun
// @io-wall-ok — tools composition root
/**
 * Forbid raw `.sql` schema files under libs/, pkgs/, apps/, test/.
 * Domain schema must be declared via defineTable + @pkgs/db-schema;
 * framework/infra DDL stays as TypeScript DatabaseMigration units.
 */
import { relative } from 'node:path';
import { Glob } from 'bun';
import { REPO_ROOT } from './io-scan-roots';

const ROOTS = ['libs', 'pkgs', 'apps', 'test'] as const;

const offenders: string[] = [];

for (const root of ROOTS) {
  const glob = new Glob(`${root}/**/*.sql`);
  for (const rel of glob.scanSync({ cwd: REPO_ROOT, absolute: false })) {
    offenders.push(rel);
  }
}

if (offenders.length === 0) {
  console.log('ci:no-raw-schema-sql OK — 0 .sql files under libs/pkgs/apps/test');
  process.exit(0);
}

console.error(
  'ci:no-raw-schema-sql FAILED — raw .sql schema files are banned.\n' +
    'Use defineTable (@pkgs/db-schema) for domain tables, or a DatabaseMigration\n' +
    'TypeScript DDL unit for framework/infra.\n'
);
for (const rel of offenders.sort()) {
  console.error(`  - ${relative(REPO_ROOT, `${REPO_ROOT}/${rel}`)}`);
}
process.exit(1);
