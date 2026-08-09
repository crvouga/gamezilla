/**
 * Ban SQL-engine wall clock / RNG defaults and DML.
 *
 * App-supplied now/createId must own timestamps and ids — no DEFAULT now(),
 * gen_random_uuid(), randomblob, strftime('now'), datetime('now'), or bare
 * SQL now()/gen_random_uuid() outside the burn-down allowlist.
 *
 * Only scans .sql files and known SQL-emitting TS modules (avoids JS `now()`).
 *
 * Burn-down: tools/io-sql-wall-allowlist.json
 * GENERATE_ALLOWLIST=1 rewrites the allowlist from current offenses.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

import { collectSqlWallScanFiles, REPO_ROOT } from './io-scan-roots';

const ALLOWLIST_PATH = join(REPO_ROOT, 'tools/io-sql-wall-allowlist.json');

/** Permanent allow — pg-mem registers gen_random_uuid as an extension stub. */
const PERMANENT_PREFIXES: readonly string[] = [
  'pkgs/sql-client/src/postgres/impl-pg-mem.ts',
  'pkgs/sql-client/src/postgres/impl-pg-mem.test.ts',
];

type Ban = {
  readonly kind: string;
  readonly re: RegExp;
};

const BANS: readonly Ban[] = [
  { kind: 'DEFAULT now()', re: /DEFAULT\s+now\s*\(\s*\)/i },
  {
    kind: 'DEFAULT gen_random_uuid()',
    re: /DEFAULT\s+gen_random_uuid\s*\(\s*\)/i,
  },
  { kind: 'randomblob(', re: /\brandomblob\s*\(/i },
  {
    kind: "strftime('now')",
    re: /strftime\s*\([^)]*['"]now['"]/i,
  },
  { kind: "datetime('now')", re: /datetime\s*\(\s*['"]now['"]\s*\)/i },
  {
    kind: 'COALESCE(..., now())',
    re: /COALESCE\s*\([^;]*?(?<![.\w])now\s*\(\s*\)/i,
  },
  { kind: 'sql now()', re: /(?<![.\w])now\s*\(\s*\)/i },
  {
    kind: 'gen_random_uuid()',
    re: /(?<!DEFAULT\s)(?<![.\w])gen_random_uuid\s*\(\s*\)/i,
  },
];

type Offense = {
  readonly path: string;
  readonly line: number;
  readonly kind: string;
};

function offenseKey(o: Offense): string {
  return `${o.path}:${String(o.line)}:${o.kind}`;
}

function isPermanentAllow(rel: string): boolean {
  return PERMANENT_PREFIXES.some((p) => rel === p || rel.startsWith(`${p}/`));
}

/** Paths that emit or embed SQL (not general TS with injected `now` callbacks). */
function isSqlishPath(rel: string): boolean {
  if (rel.endsWith('.sql')) return true;
  const base = rel.split('/').pop() ?? '';
  if (
    base === 'emit.ts' ||
    base === 'framework-server-ddl.ts' ||
    base === 'migrate-sql.ts' ||
    base === 'tick-sql.ts' ||
    base === 'open-sim-sqlite.ts' ||
    base === 'impl-postgres.ts' ||
    base === 'impl-postgres-tx.ts'
  ) {
    return true;
  }
  // Tests that assert SQL text may still embed wall defaults — scan them too.
  if (base.endsWith('.test.ts') || base.endsWith('.test.tsx')) {
    return /migrate|emit|ddl|sql-map|schema|tick-sql|open-sim/.test(rel);
  }
  return false;
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
  if (isPermanentAllow(rel)) return [];
  if (!isSqlishPath(rel)) return [];
  const isSql = rel.endsWith('.sql');
  const text = readFileSync(abs, 'utf8');
  const lines = text.split('\n');
  const out: Offense[] = [];
  for (let i = 0; i < lines.length; i++) {
    const code = stripLineComment(lines[i] ?? '', isSql);
    if (code.length === 0) continue;
    for (const ban of BANS) {
      if (!ban.re.test(code)) continue;
      // DEFAULT now() already reported — skip duplicate sql now() on same line.
      if (ban.kind === 'sql now()' && /DEFAULT\s+now\s*\(\s*\)/i.test(code)) {
        continue;
      }
      if (
        ban.kind === 'gen_random_uuid()' &&
        /DEFAULT\s+gen_random_uuid\s*\(\s*\)/i.test(code)
      ) {
        continue;
      }
      out.push({ path: rel, line: i + 1, kind: ban.kind });
    }
  }
  return out;
}

function loadAllowlist(): Set<string> {
  if (!existsSync(ALLOWLIST_PATH)) return new Set();
  const raw = JSON.parse(readFileSync(ALLOWLIST_PATH, 'utf8')) as unknown;
  if (!Array.isArray(raw)) {
    throw new Error(
      'io-sql-wall-allowlist.json must be a JSON array of strings'
    );
  }
  return new Set(raw.map((x) => String(x)));
}

const files = collectSqlWallScanFiles();
const offenses: Offense[] = [];
for (const f of files) {
  offenses.push(...scanFile(f));
}

if (process.env['GENERATE_ALLOWLIST'] === '1') {
  const keys = [...new Set(offenses.map(offenseKey))].sort();
  writeFileSync(ALLOWLIST_PATH, `${JSON.stringify(keys, null, 2)}\n`);
  console.log(
    `Wrote ${String(keys.length)} allowlist entries → tools/io-sql-wall-allowlist.json`
  );
  process.exit(0);
}

const allow = loadAllowlist();
const offenseKeys = new Set(offenses.map(offenseKey));

const unexpected = offenses.filter((o) => !allow.has(offenseKey(o)));
const stale = [...allow].filter((k) => !offenseKeys.has(k));

if (unexpected.length > 0 || stale.length > 0) {
  if (unexpected.length > 0) {
    console.error(
      'SQL wall-I/O check failed — inject now/createId; do not use engine now()/uuid defaults:\n'
    );
    for (const o of unexpected.slice(0, 200)) {
      console.error(`  - ${offenseKey(o)}`);
    }
    if (unexpected.length > 200) {
      console.error(`  … and ${String(unexpected.length - 200)} more`);
    }
  }
  if (stale.length > 0) {
    console.error(
      '\nStale allowlist entries (remove from tools/io-sql-wall-allowlist.json):\n'
    );
    for (const k of stale.slice(0, 100)) {
      console.error(`  - ${k}`);
    }
  }
  process.exit(1);
}

console.log(
  `SQL wall-I/O check passed (${String(files.length)} files, ${String(offenses.length)} allowlisted, ${String(allow.size)} allowlist entries).`
);
