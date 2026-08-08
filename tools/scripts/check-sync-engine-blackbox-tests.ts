#!/usr/bin/env bun
/**
 * Enforce black-box sync-engine tests:
 * - all `*.test.ts` live under `pkgs/sync-engine/src/tests/`
 * - scenario tests do not assert framework tables or import private modules
 */
import { join } from 'node:path';
import { Glob } from 'bun';

const root = join(import.meta.dirname, '../..');
const pkg = 'pkgs/sync-engine';
const testsRoot = `${pkg}/src/tests`;

const violations: string[] = [];

const FORBIDDEN_TABLE_RE =
  /\b(_push_applied|_mutations_applied|_mutations|_scope_meta|write_rejections|sqlite_master)\b/;

/** Relative deep imports into package internals (not sim / tests). */
const PRIVATE_RELATIVE_IMPORT_RE =
  /from\s+['"](?:\.\.\/)+(?:client|server|mutations|queries|shared)\//;

/** Package deep path — only four public entrypoints are allowed. */
const PRIVATE_PACKAGE_IMPORT_RE = /from\s+['"]@pkgs\/sync-engine\/src\//;

const ALLOWED_PACKAGE_IMPORT_RE =
  /from\s+['"]@pkgs\/sync-engine\/(client|server|shared|test)['"]/;

for await (const file of new Glob(`${pkg}/src/**/*.test.ts`).scan({
  cwd: root,
  absolute: false,
})) {
  if (!file.startsWith(`${testsRoot}/`)) {
    violations.push(`${file}: test must live under ${testsRoot}/`);
  }
}

for await (const file of new Glob(`${testsRoot}/scenarios/**/*.test.ts`).scan({
  cwd: root,
  absolute: false,
})) {
  const text = await Bun.file(join(root, file)).text();
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]!;
    if (FORBIDDEN_TABLE_RE.test(line)) {
      violations.push(
        `${file}:${i + 1}: scenario must not reference framework tables`
      );
    }
    if (PRIVATE_RELATIVE_IMPORT_RE.test(line)) {
      violations.push(
        `${file}:${i + 1}: scenario must not import sync-engine internals`
      );
    }
    if (PRIVATE_PACKAGE_IMPORT_RE.test(line)) {
      violations.push(
        `${file}:${i + 1}: scenario must not deep-import @pkgs/sync-engine/src`
      );
    }
    if (
      line.includes('@pkgs/sync-engine/') &&
      line.includes('from') &&
      !ALLOWED_PACKAGE_IMPORT_RE.test(line) &&
      !line.includes('@pkgs/sync-engine/src/')
    ) {
      // Allow only the four public entrypoints when importing the package.
      const m = line.match(/from\s+['"](@pkgs\/sync-engine\/[^'"]+)['"]/);
      if (m !== null && !ALLOWED_PACKAGE_IMPORT_RE.test(line)) {
        violations.push(
          `${file}:${i + 1}: scenario may only import @pkgs/sync-engine/{client,server,shared,test}`
        );
      }
    }
  }
}

if (violations.length > 0) {
  console.error('ci:sync-engine-blackbox-tests FAILED:');
  for (const v of violations) console.error(`  - ${v}`);
  process.exit(1);
}

console.log('ci:sync-engine-blackbox-tests OK');
