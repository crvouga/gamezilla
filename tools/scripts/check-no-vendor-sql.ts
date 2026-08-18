// @io-wall-ok — tools composition root
// @io-wall-ok — tools composition root
/**
 * Ban vendor-specific SQL in application code.
 *
 * Shared ban list: `@pkgs/sql-client/agnostic-sql`. Opt out with
 * `// @sql-vendor-ok` on driver/compat/third-party migrate files only.
 */
import { readFileSync } from 'node:fs';
import { relative } from 'node:path';

import {
  AGNOSTIC_SQL_BANS,
  findAgnosticSqlBan,
} from '../../pkgs/sql-client/src/agnostic-sql';
import { collectSqlWallScanFiles, REPO_ROOT } from './io-scan-roots';

const VENDOR_OK_LINE =
  /^\s*(?:\/\/|\*|\/\*\*?)\s*@sql-vendor-ok\b|^\s*@sql-vendor-ok\b/;

function fileHasSqlVendorOkPragma(text: string): boolean {
  for (const line of text.split('\n')) {
    if (VENDOR_OK_LINE.test(line)) return true;
  }
  return false;
}

/** Paths that are allowed to contain vendor SQL (drivers, shims, goldens). */
function isVendorSqlExemptPath(rel: string): boolean {
  if (rel.startsWith('pkgs/postgres-sqlite-compat/')) return true;
  if (rel.startsWith('pkgs/sql-client/src/postgres/')) return true;
  if (rel.startsWith('pkgs/sql-client/src/positional-params')) return true;
  if (rel.includes('/sql-client/src/sqlite/connection-pragmas')) return true;
  if (rel.includes('/sql-client/src/sqlite/assert-sqlite-query')) return true;
  // Compat strip helpers (removed later) and agnostic ban self-tests.
  if (rel.includes('/sql-client/src/agnostic-sql')) return true;
  if (rel.includes('/sql-client/src/impl-agnostic')) return true;
  if (rel.includes('/sql-client/src/sqlite/impl-bun-sqlite')) return true;
  if (rel.includes('/sql-client/src/sqlite/impl-better-sqlite3')) return true;
  if (rel.includes('/sql-client/src/sqlite/impl-sqlite-mem')) return true;
  if (rel.includes('/sql-client/src/sqlite/expo-sqlite-core')) return true;
  // SQL AST / map compiler goldens intentionally include PG dialect.
  if (rel.startsWith('pkgs/sql-map/')) return true;
  if (rel.startsWith('pkgs/sql/src/')) return true;
  // Better Auth third-party migrate surface.
  if (rel.startsWith('pkgs/auth-better-auth/')) return true;
  return false;
}

/** Same SQL-ish filter as ci:no-sql-wall-io, plus repositories that embed SQL. */
function isSqlishPath(rel: string): boolean {
  if (rel.endsWith('.sql')) return true;
  const base = rel.split('/').pop() ?? '';
  if (
    base === 'emit.ts' ||
    base === 'framework-server-ddl.ts' ||
    base === 'migrate-sql.ts' ||
    base === 'open-sim-sqlite.ts' ||
    base === 'impl-postgres.ts' ||
    base === 'impl-postgres-tx.ts' ||
    base === 'catalog.ts' ||
    base.endsWith('-repository.ts') ||
    base.endsWith('-queries.ts') ||
    // "migration".includes("migrate") is false — match both stems.
    base.includes('migrate') ||
    base.includes('migration') ||
    base.includes('seed') ||
    base.includes('ddl')
  ) {
    return true;
  }
  if (base.endsWith('.test.ts') || base.endsWith('.test.tsx')) {
    return /migrate|migration|emit|ddl|sql-map|schema|open-sim|agnostic|compat/.test(
      rel
    );
  }
  // Matchmaking / sync SQL modules; chess (and other) seed helpers.
  if (
    rel.includes('/impl-sql/') ||
    rel.includes('/matchmaker') ||
    rel.includes('/sync-engine/') ||
    rel.includes('/seed-') ||
    (rel.includes('/db-schema/') && base === 'catalog.ts')
  ) {
    return true;
  }
  return false;
}

type Offense = {
  readonly path: string;
  readonly line: number;
  readonly kind: string;
};

function offenseKey(o: Offense): string {
  return `${o.path}:${String(o.line)}:${o.kind}`;
}

function stripLineComment(line: string, isSql: boolean): string {
  const trimmed = line.trim();
  if (isSql) {
    if (trimmed.startsWith('--')) return '';
  } else {
    if (
      trimmed.startsWith('//') ||
      trimmed.startsWith('*') ||
      trimmed.startsWith('/*')
    ) {
      return '';
    }
  }
  const idx = line.indexOf(isSql ? '--' : '//');
  if (idx >= 0) return line.slice(0, idx);
  return line;
}

function scanFile(abs: string): Offense[] {
  const rel = relative(REPO_ROOT, abs);
  if (!isSqlishPath(rel)) return [];
  if (isVendorSqlExemptPath(rel)) return [];
  const isSql = rel.endsWith('.sql');
  const text = readFileSync(abs, 'utf8');
  if (fileHasSqlVendorOkPragma(text)) return [];
  const lines = text.split('\n');
  const out: Offense[] = [];
  for (let i = 0; i < lines.length; i++) {
    const code = stripLineComment(lines[i] ?? '', isSql);
    if (code.length === 0) continue;
    const kind = findAgnosticSqlBan(code);
    if (kind === null) continue;
    out.push({ path: rel, line: i + 1, kind });
  }
  return out;
}

// Touch shared ban list so turbo inputs stay honest when only bans change.
void AGNOSTIC_SQL_BANS.length;

const files = await collectSqlWallScanFiles();
const offenses: Offense[] = [];
for (const f of files) {
  offenses.push(...scanFile(f));
}

if (offenses.length > 0) {
  console.error(
    'Vendor SQL check failed — use portable (SQLite-shaped) SQL.\n' +
      'Driver/compat/third-party migrate may mark `// @sql-vendor-ok`:\n'
  );
  for (const o of offenses.slice(0, 200)) {
    console.error(`  - ${offenseKey(o)}`);
  }
  if (offenses.length > 200) {
    console.error(`  … and ${String(offenses.length - 200)} more`);
  }
  process.exit(1);
}

console.log(`Vendor SQL check passed (${String(files.length)} files).`);
