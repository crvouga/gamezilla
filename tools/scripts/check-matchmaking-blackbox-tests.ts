// @io-wall-ok — tools composition root
/**
 * Enforce black-box matchmaking tests:
 * - all `*.test.ts` live under `pkgs/matchmaking/src/tests/`
 * - scenario tests do not import impl-sql / sql-client / PGlite or mention
 *   framework tables / claim columns
 */
import { join } from 'node:path';
import { Glob } from 'bun';

const root = join(import.meta.dirname, '../..');
const pkg = 'pkgs/matchmaking';
const testsRoot = `${pkg}/src/tests`;

const violations: string[] = [];

const FORBIDDEN_IMPORT_RE =
  /from\s+['"][^'"]*(?:impl-sql|sql-client|@electric-sql\/pglite)['"]|createPgliteSqlClient|SqlClientImpl/;

const FORBIDDEN_TABLE_RE =
  /\b(matchmaking_waiting|matchmaking_matched|matchmaking_active_partitions|matchmaking_schema_state|claim_token)\b/;

for await (const file of new Glob(`${pkg}/src/**/*.test.ts`).scan({
  cwd: root,
  absolute: false,
})) {
  if (!file.startsWith(`${testsRoot}/`)) {
    violations.push(`${file}: test must live under ${testsRoot}/`);
  }
}

for await (const file of new Glob(
  `${testsRoot}/scenarios/**/*.{test.ts,sim.test.ts}`
).scan({
  cwd: root,
  absolute: false,
})) {
  const text = await Bun.file(join(root, file)).text();
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]!;
    const n = i + 1;
    if (FORBIDDEN_IMPORT_RE.test(line)) {
      violations.push(`${file}:${String(n)}: scenario imports adapter/SQL`);
    }
    if (FORBIDDEN_TABLE_RE.test(line)) {
      violations.push(
        `${file}:${String(n)}: scenario mentions framework table/claim`
      );
    }
  }
}

if (violations.length > 0) {
  console.error('ci:matchmaking-blackbox-tests FAILED:');
  for (const v of violations) console.error(`  ${v}`);
  process.exit(1);
}
console.log('ci:matchmaking-blackbox-tests OK');
