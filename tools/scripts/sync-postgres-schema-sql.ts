#!/usr/bin/env bun
/**
 * Compare live Postgres schemas for secrets envs `dev` and `prd`.
 * When equivalent, optionally collapse the shared end-state into
 * `libs/db/src/server/schema.sql` as idempotent DDL (no migration history).
 *
 * Reads both DATABASE_URLs via the secret admin store (not secrets-run).
 * Requires `--confirm-prd` (always reads production). Read-only against DBs.
 *
 * Exit codes:
 *   0 — schemas equivalent (and wrote if `--write`)
 *   1 — schemas differ
 *   2 — tooling / auth / pg_dump failure
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, renameSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { appPostgresDbScope } from '@libs/infra/namespace-bindings';
import {
  PG_DUMP_REQUIRED_MAJOR,
  PgDumpDep,
  resolvePgDumpPath,
} from '../../libs/infra/src/cli/deps/pg-dump';
import { createSecretAdminStore } from '@pkgs/secret-provider';
import { resolveSecretsScope } from '@pkgs/secrets-config';

const REPO_ROOT = join(import.meta.dirname, '../..');
const SCHEMA_SQL_PATH = join(REPO_ROOT, 'libs/db/src/server/schema.sql');

const EXIT_MATCH = 0;
const EXIT_DIFF = 1;
const EXIT_TOOLING = 2;

type CliArgs = {
  readonly confirmPrd: boolean;
  readonly write: boolean;
  readonly schema: string;
};

function log(message: string): void {
  const ts = new Date().toISOString().replace('T', ' ').slice(0, 19);
  console.log(`[${ts}] ${message}`);
}

function failTooling(message: string): never {
  log(`ERROR: ${message}`);
  process.exit(EXIT_TOOLING);
}

function usage(): never {
  console.error(`usage: bun run db:schema:sync -- --confirm-prd [--write] [--schema <name>]

Compare secrets-env \`dev\` vs \`prd\` Postgres schemas (pg_dump --schema-only).
When equivalent, \`--write\` overwrites libs/db/src/server/schema.sql with
collapsed idempotent end-state DDL.

  --confirm-prd   Required (script always fetches the prd DATABASE_URL)
  --write         Overwrite schema.sql only when dumps match
  --schema NAME   Postgres schema to dump (default: appPostgresDbScope)
`);
  process.exit(EXIT_TOOLING);
}

function parseArgs(argv: readonly string[]): CliArgs {
  let confirmPrd = false;
  let write = false;
  let schema = appPostgresDbScope().schema;
  let i = 0;
  while (i < argv.length) {
    const arg = argv[i]!;
    if (arg === '--confirm-prd') {
      confirmPrd = true;
      i += 1;
      continue;
    }
    if (arg === '--write') {
      write = true;
      i += 1;
      continue;
    }
    if (arg === '--schema') {
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('-')) {
        failTooling('--schema requires a name');
      }
      schema = next;
      i += 2;
      continue;
    }
    if (arg === '--help' || arg === '-h') {
      usage();
    }
    failTooling(`unknown argument: ${arg}`);
  }
  if (!confirmPrd) {
    failTooling(
      'refusing to fetch prd DATABASE_URL without --confirm-prd (pass: --confirm-prd)'
    );
  }
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(schema)) {
    failTooling(`invalid --schema name: ${schema}`);
  }
  return { confirmPrd, write, schema };
}

function requirePgDump(): string {
  const st = new PgDumpDep().check();
  if (!st.ok) {
    failTooling(st.reason);
  }
  const bin = resolvePgDumpPath();
  if (bin === null) {
    failTooling(
      `pg_dump (PostgreSQL ${PG_DUMP_REQUIRED_MAJOR}+) not found — run \`bun run infra setup\``
    );
  }
  return bin;
}

function scrubPgUrl(text: string): string {
  return text.replace(/postgres(?:ql)?:\/\/[^@\s]+@/gi, 'postgres://***:***@');
}

async function fetchDatabaseUrl(secretsEnv: 'dev' | 'prd'): Promise<string> {
  const scope = resolveSecretsScope(REPO_ROOT, secretsEnv);
  log(
    `Fetching DATABASE_URL from secret store (projectId=${scope.projectId}, env=${scope.env})`
  );
  try {
    const admin = await createSecretAdminStore({ repoRoot: REPO_ROOT });
    const url = (await admin.fetchSecret('DATABASE_URL', secretsEnv)).trim();
    if (url.length === 0) {
      failTooling(
        `Secret store returned an empty DATABASE_URL for ${secretsEnv}`
      );
    }
    return url;
  } catch (e) {
    const detail = scrubPgUrl(e instanceof Error ? e.message : String(e));
    failTooling(
      detail.length > 0
        ? `Secret fetch failed (${secretsEnv}): ${detail}`
        : `Secret fetch failed (${secretsEnv}) — check authentication and project scope`
    );
  }
}

function pgDumpSchema(
  pgDumpBin: string,
  databaseUrl: string,
  schema: string
): string {
  const result = spawnSync(
    pgDumpBin,
    [
      databaseUrl,
      '--schema-only',
      '--no-owner',
      '--no-privileges',
      `--schema=${schema}`,
    ],
    {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 32 * 1024 * 1024,
    }
  );

  if (result.error !== undefined) {
    failTooling(`pg_dump spawn failed: ${result.error.message}`);
  }
  if (result.status !== 0) {
    const detail = scrubPgUrl(
      (result.stderr ?? '').toString().trim() ||
        (result.stdout ?? '').toString().trim()
    );
    failTooling(
      detail.length > 0 ? `pg_dump failed: ${detail}` : 'pg_dump failed'
    );
  }
  return (result.stdout ?? '').toString();
}

/**
 * Strip dump noise that differs across envs without schema meaning, and
 * stabilize whitespace for comparison.
 */
export function normalizeSchemaDump(dump: string): string {
  const lines = dump.split(/\r?\n/);
  const kept: string[] = [];
  for (const rawLine of lines) {
    const line = rawLine.replace(/\s+$/u, '');
    if (line.length === 0) {
      if (kept.length > 0 && kept[kept.length - 1] !== '') {
        kept.push('');
      }
      continue;
    }
    if (line.startsWith('--')) {
      // Drop dump headers / timestamps / Dumped from / Dumped by
      continue;
    }
    if (/^SET\b/i.test(line)) {
      continue;
    }
    if (/^SELECT\s+pg_catalog\.set_config\b/i.test(line)) {
      continue;
    }
    if (/^\\(restrict|unrestrict)\b/i.test(line)) {
      continue;
    }
    kept.push(line);
  }
  while (kept.length > 0 && kept[kept.length - 1] === '') {
    kept.pop();
  }
  return `${kept.join('\n')}\n`;
}

function splitTopLevelStatements(sql: string): string[] {
  const statements: string[] = [];
  let current = '';
  let inDollar = false;
  let inSingle = false;
  for (let i = 0; i < sql.length; i += 1) {
    const ch = sql[i]!;
    if (!inSingle && sql.startsWith('$$', i)) {
      inDollar = !inDollar;
      current += '$$';
      i += 1;
      continue;
    }
    if (!inDollar && ch === "'" && sql[i - 1] !== '\\') {
      if (inSingle && sql[i + 1] === "'") {
        current += "''";
        i += 1;
        continue;
      }
      inSingle = !inSingle;
      current += ch;
      continue;
    }
    if (!inDollar && !inSingle && ch === ';') {
      const trimmed = current.trim();
      if (trimmed.length > 0) {
        statements.push(trimmed);
      }
      current = '';
      continue;
    }
    current += ch;
  }
  const trailing = current.trim();
  if (trailing.length > 0) {
    statements.push(trailing);
  }
  return statements;
}

function statementSortKey(statement: string): string {
  const s = statement.replace(/\s+/gu, ' ').trim();
  // Include UNLOGGED so kv-style tables sort with ordinary CREATE TABLE (before ALTER).
  const createTable =
    /^CREATE (?:UNLOGGED )?TABLE(?: IF NOT EXISTS)?\s+([^\s(]+)/i.exec(s);
  if (createTable) {
    return `1:table:${createTable[1]!.toLowerCase()}`;
  }
  const createType = /^CREATE TYPE(?: IF NOT EXISTS)?\s+([^\s]+)/i.exec(s);
  if (createType) {
    return `0:type:${createType[1]!.toLowerCase()}`;
  }
  const createSeq = /^CREATE SEQUENCE(?: IF NOT EXISTS)?\s+([^\s]+)/i.exec(s);
  if (createSeq) {
    return `0:seq:${createSeq[1]!.toLowerCase()}`;
  }
  const createIndex =
    /^CREATE (?:UNIQUE )?INDEX(?: IF NOT EXISTS)?\s+([^\s]+)/i.exec(s);
  if (createIndex) {
    return `3:index:${createIndex[1]!.toLowerCase()}`;
  }
  const alter = /^ALTER TABLE(?: ONLY)?\s+([^\s]+)/i.exec(s);
  if (alter) {
    return `2:alter:${alter[1]!.toLowerCase()}:${s.toLowerCase()}`;
  }
  return `9:other:${s.toLowerCase()}`;
}

/** Stable ordering for comparison / collapsed output. */
export function stabilizeSchemaStatements(normalizedDump: string): string {
  const statements = splitTopLevelStatements(normalizedDump);
  const sorted = [...statements].sort((a, b) =>
    statementSortKey(a).localeCompare(statementSortKey(b))
  );
  return sorted.map((s) => `${s};\n`).join('\n');
}

/**
 * Canonicalize dump text so env-local cosmetic differences (constraint
 * names, CREATE TABLE column order, explicit NULLS LAST/FIRST on indexes)
 * do not count as schema mismatch. Structural shape (columns, types,
 * constraint kinds + columns, index expressions) is preserved.
 */
export function canonicalizeSchemaForCompare(stabilizedDump: string): string {
  const statements = splitTopLevelStatements(stabilizedDump);
  const canonical = statements.map((statement) =>
    canonicalizeStatementForCompare(statement)
  );
  const sorted = [...canonical].sort((a, b) =>
    statementSortKey(a).localeCompare(statementSortKey(b))
  );
  return sorted.map((s) => `${s};\n`).join('\n');
}

function canonicalizeStatementForCompare(statement: string): string {
  let s = statement.replace(/\s+/gu, ' ').trim();

  // Index NULLS FIRST/LAST: equivalent for app schema sync comparison.
  s = s.replace(/\s+NULLS\s+(FIRST|LAST)\b/giu, '');

  // Constraint names differ across create paths (postgres defaults vs drizzle).
  s = s.replace(
    /\bADD CONSTRAINT\s+\S+\s+(PRIMARY KEY\b)/giu,
    'ADD CONSTRAINT __pk__ $1'
  );
  s = s.replace(
    /\bADD CONSTRAINT\s+\S+\s+(UNIQUE\b)/giu,
    'ADD CONSTRAINT __uq__ $1'
  );
  s = s.replace(
    /\bADD CONSTRAINT\s+\S+\s+(FOREIGN KEY\b)/giu,
    'ADD CONSTRAINT __fk__ $1'
  );
  s = s.replace(
    /\bADD CONSTRAINT\s+\S+\s+(CHECK\b)/giu,
    'ADD CONSTRAINT __ck__ $1'
  );

  const createTable =
    /^(CREATE TABLE(?: IF NOT EXISTS)?\s+[^\s(]+)\s*\((.*)\)\s*$/isu.exec(s);
  if (createTable) {
    const head = createTable[1]!;
    const body = createTable[2]!;
    const cols = splitCreateTableColumns(body)
      .map((c) => c.replace(/\s+/gu, ' ').trim())
      .filter((c) => c.length > 0)
      .sort((a, b) => a.localeCompare(b));
    return `${head} (\n    ${cols.join(',\n    ')}\n)`;
  }

  return s;
}

function splitCreateTableColumns(body: string): string[] {
  const cols: string[] = [];
  let current = '';
  let depth = 0;
  let inSingle = false;
  for (let i = 0; i < body.length; i += 1) {
    const ch = body[i]!;
    if (ch === "'" && body[i - 1] !== '\\') {
      if (inSingle && body[i + 1] === "'") {
        current += "''";
        i += 1;
        continue;
      }
      inSingle = !inSingle;
      current += ch;
      continue;
    }
    if (!inSingle) {
      if (ch === '(') {
        depth += 1;
      } else if (ch === ')') {
        depth -= 1;
      } else if (ch === ',' && depth === 0) {
        cols.push(current.trim());
        current = '';
        continue;
      }
    }
    current += ch;
  }
  const trailing = current.trim();
  if (trailing.length > 0) {
    cols.push(trailing);
  }
  return cols;
}

function unifiedDiff(devText: string, prdText: string): string {
  const tmpDir = join(tmpdir(), `gamezilla-schema-sync-${process.pid}`);
  mkdirSync(tmpDir, { recursive: true });
  const devPath = join(tmpDir, 'dev.sql');
  const prdPath = join(tmpDir, 'prd.sql');
  writeFileSync(devPath, devText);
  writeFileSync(prdPath, prdText);
  const diff = spawnSync(
    'diff',
    ['-u', '--label', 'dev', '--label', 'prd', devPath, prdPath],
    {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 32 * 1024 * 1024,
    }
  );
  if (diff.error !== undefined) {
    return `--- dev\n+++ prd\n(dev and prd normalized dumps differ; install diff for unified output)\n`;
  }
  return (diff.stdout ?? '').toString() || (diff.stderr ?? '').toString();
}

/** `kv` DDL is owned by `KvImplPostgres.migrateUp` — never fold into schema.sql. */
function isKvOwnedStatement(statement: string): boolean {
  const s = statement.replace(/\s+/gu, ' ').trim();
  if (
    /^CREATE\s+(?:UNLOGGED\s+)?TABLE(?:\s+IF\s+NOT\s+EXISTS)?\s+(?:public\.)?kv\b/i.test(
      s
    )
  ) {
    return true;
  }
  if (/^ALTER\s+TABLE(?:\s+ONLY)?\s+(?:public\.)?kv\b/i.test(s)) {
    return true;
  }
  if (
    /^CREATE\s+(?:UNIQUE\s+)?INDEX(?:\s+IF\s+NOT\s+EXISTS)?\s+\S+\s+ON\s+(?:public\.)?kv\b/i.test(
      s
    )
  ) {
    return true;
  }
  return false;
}

function makeIdempotentStatement(statement: string): string | null {
  let s = statement.trim();
  if (s.length === 0) {
    return null;
  }
  // Drop schema creation / search_path / ownership leftovers
  if (/^CREATE SCHEMA\b/i.test(s)) {
    return null;
  }
  if (/^ALTER SCHEMA\b/i.test(s)) {
    return null;
  }
  if (/^COMMENT ON\b/i.test(s)) {
    return null;
  }
  if (isKvOwnedStatement(s)) {
    return null;
  }

  s = s.replace(
    /^CREATE TABLE(?!\s+IF NOT EXISTS)\b/i,
    'CREATE TABLE IF NOT EXISTS'
  );
  s = s.replace(
    /^CREATE UNLOGGED TABLE(?!\s+IF NOT EXISTS)\b/i,
    'CREATE UNLOGGED TABLE IF NOT EXISTS'
  );
  s = s.replace(
    /^CREATE UNIQUE INDEX(?!\s+IF NOT EXISTS)\b/i,
    'CREATE UNIQUE INDEX IF NOT EXISTS'
  );
  s = s.replace(
    /^CREATE INDEX(?!\s+IF NOT EXISTS)\b/i,
    'CREATE INDEX IF NOT EXISTS'
  );
  s = s.replace(
    /^CREATE SEQUENCE(?!\s+IF NOT EXISTS)\b/i,
    'CREATE SEQUENCE IF NOT EXISTS'
  );

  // FK / check / PK / UNIQUE from pg_dump are separate ALTER TABLE ADD CONSTRAINT
  // and are not IF NOT EXISTS — wrap for idempotent re-run.
  // On migrate re-run Postgres may raise any of:
  //   duplicate_object (42710) — constraint name already exists
  //   duplicate_table (42P07) — UNIQUE/PK backing index already exists
  //   invalid_table_definition (42P16) — table already has a PRIMARY KEY
  if (
    /^ALTER TABLE\b/i.test(s) &&
    /\bADD CONSTRAINT\b/i.test(s) &&
    !/\bIF NOT EXISTS\b/i.test(s)
  ) {
    const escaped = s.replace(/'/g, "''");
    return `DO $$ BEGIN\n  EXECUTE '${escaped}';\nEXCEPTION\n  WHEN duplicate_object THEN NULL;\n  WHEN duplicate_table THEN NULL;\n  WHEN invalid_table_definition THEN NULL;\nEND $$`;
  }

  return s;
}

/**
 * Transform a normalized dump into idempotent end-state DDL for schema.sql.
 */
export function collapseDumpToIdempotentSql(normalizedDump: string): string {
  const stabilized = stabilizeSchemaStatements(normalizedDump);
  const statements = splitTopLevelStatements(stabilized);
  const out: string[] = [];
  for (const statement of statements) {
    const next = makeIdempotentStatement(statement);
    if (next !== null) {
      out.push(`${next};`);
    }
  }
  const date = new Date().toISOString().slice(0, 10);
  const header = `-- ============ Base schema ============
-- Idempotent Postgres DDL for the PowerSync source database.
-- Collapsed from live secrets-env \`dev\` + \`prd\` schemas (${date}).
-- Re-run in full on every deploy. Statements must stay safe to repeat.
-- PowerSync publication remains in libs/infra powersync-source-db.sql.
`;
  return `${header}\n${out.join('\n\n')}\n`;
}

function writeSchemaSqlAtomically(contents: string): void {
  const dir = dirname(SCHEMA_SQL_PATH);
  mkdirSync(dir, { recursive: true });
  const tmp = join(dir, `.schema.sql.${process.pid}.tmp`);
  writeFileSync(tmp, contents, 'utf8');
  renameSync(tmp, SCHEMA_SQL_PATH);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const pgDumpBin = requirePgDump();
  log(`Using ${pgDumpBin}`);

  log(`Dumping schema=${args.schema} from secrets envs dev and prd`);
  const [devUrl, prdUrl] = await Promise.all([
    fetchDatabaseUrl('dev'),
    fetchDatabaseUrl('prd'),
  ]);

  log('Running pg_dump --schema-only (dev)');
  const devRaw = pgDumpSchema(pgDumpBin, devUrl, args.schema);
  log('Running pg_dump --schema-only (prd)');
  const prdRaw = pgDumpSchema(pgDumpBin, prdUrl, args.schema);

  const devNorm = stabilizeSchemaStatements(normalizeSchemaDump(devRaw));
  const prdNorm = stabilizeSchemaStatements(normalizeSchemaDump(prdRaw));
  const devCompare = canonicalizeSchemaForCompare(devNorm);
  const prdCompare = canonicalizeSchemaForCompare(prdNorm);

  if (devCompare !== prdCompare) {
    log('Schemas DIFFER between dev and prd');
    const diffText = unifiedDiff(devCompare, prdCompare);
    process.stderr.write(diffText);
    if (!diffText.endsWith('\n')) {
      process.stderr.write('\n');
    }
    if (args.write) {
      log('Refusing --write because schemas are not equivalent');
    }
    process.exit(EXIT_DIFF);
  }

  log('Schemas MATCH between dev and prd');
  if (!args.write) {
    log('Pass --write to collapse into libs/db/src/server/schema.sql');
    process.exit(EXIT_MATCH);
  }

  const collapsed = collapseDumpToIdempotentSql(devNorm);
  writeSchemaSqlAtomically(collapsed);
  log(`Wrote collapsed idempotent schema → ${SCHEMA_SQL_PATH}`);
  process.exit(EXIT_MATCH);
}

if (import.meta.main) {
  void main().catch((e) => {
    failTooling(scrubPgUrl(e instanceof Error ? e.message : String(e)));
  });
}
