import type { Database } from 'bun:sqlite';
import { assert } from '@pkgs/assert-root-shared-ts/singleton';
import { sortByName } from '@pkgs/db-indexes-root-shared-ts/compare';
import type { Config } from '@pkgs/db-indexes-root-shared-ts/config';
import { DEFAULT_CONFIG } from '@pkgs/db-indexes-root-shared-ts/config';
import {
  isOwnedName,
  ownedIndexName,
} from '@pkgs/db-indexes-root-shared-ts/naming';
import { parseWithNodeSqlParser } from '@pkgs/db-indexes-root-shared-ts/parse-node-sql';
import type {
  ActionResult,
  Candidate,
  DbPort,
  Eval,
  IndexDefinition,
  IndexInfo,
  OwnedMeta,
  ParsedStatement,
  PlanAction,
  Stmt,
  TableInfo,
  UsageInfo,
} from '@pkgs/db-indexes-root-shared-ts/types';
import { asOwnedIndexName } from '@pkgs/db-indexes-root-shared-ts/types';
import { defineTable } from '@pkgs/db-schema-root-shared-ts/define-table';
import { registerTables } from '@pkgs/db-schema-root-shared-ts/register-tables';
import { emitSqliteCreateStatements } from '@pkgs/db-schema-sqlite-shared-ts/emit-sqlite-create';

const META_TABLE = 'autoidx_meta';

const AUTOIDX_META_SCHEMA = registerTables([
  defineTable({
    domain: 'autoidx',
    name: 'autoidx_meta',
    columns: { name: 'text', payload: 'text' },
    uniqueIndexes: ['name'],
  }),
]);

function renderCreateIndexSql(def: IndexDefinition, name: string): string {
  assert.ok(isOwnedName(name), 'render: owned name');
  const cols = def.columns.map((c) => `"${c.name}"`).join(', ');
  const extra =
    def.include.length > 0
      ? `, ${def.include.map((c) => `"${c}"`).join(', ')}`
      : '';
  const pred = def.predicate != null ? ` WHERE ${def.predicate}` : '';
  return `CREATE INDEX IF NOT EXISTS "${name}" ON "${def.table}" (${cols}${extra})${pred}`;
}

export type SqlitePortHandle = {
  readonly db: Database;
  /** Optional path for copy-eval; memory DBs skip copy. */
  readonly path?: string;
  readonly idleWindow?: boolean;
};

function ensureMeta(db: Database): void {
  for (const stmt of emitSqliteCreateStatements(AUTOIDX_META_SCHEMA)) {
    db.run(stmt);
  }
}

function mapIndexRow(r: {
  name: string;
  tbl_name: string;
  sql: string | null;
}): IndexInfo {
  const owned = isOwnedName(r.name);
  const cols =
    r.sql
      ?.match(/\(([^)]+)\)/)?.[1]
      ?.split(',')
      .map((c) => c.trim().replace(/"/g, ''))
      .filter(Boolean) ?? [];
  return {
    name: r.name,
    table: r.tbl_name,
    columns: cols,
    include: [],
    predicate: null,
    isUnique: (r.sql ?? '').toUpperCase().includes('UNIQUE'),
    isPrimary: false,
    isValid: true,
    isOwned: owned,
  };
}

async function introspectIndexes(db: Database): Promise<IndexInfo[]> {
  const rows = db
    .query<{ name: string; tbl_name: string; sql: string | null }, []>(
      `SELECT name, tbl_name, sql FROM sqlite_master WHERE type = 'index' AND name NOT LIKE 'sqlite_%'`
    )
    .all();
  return sortByName(rows.map(mapIndexRow));
}

async function introspectTables(db: Database): Promise<TableInfo[]> {
  const tables = db
    .query<{ name: string }, []>(
      `SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name != '${META_TABLE}'`
    )
    .all();
  return sortByName(
    tables.map((t) => {
      const count = db
        .query<{ c: number }, []>(`SELECT COUNT(*) AS c FROM "${t.name}"`)
        .get();
      return {
        name: t.name,
        estimatedRows: count?.c ?? 0,
      };
    })
  );
}

function metaTableExists(db: Database): boolean {
  return (
    db
      .query<{ name: string }, [string]>(
        `SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?`
      )
      .get(META_TABLE) != null
  );
}

async function readOwnedMeta(db: Database): Promise<OwnedMeta[]> {
  // Planning reads this; it must not create the table (read-only).
  if (!metaTableExists(db)) return [];
  const rows = db
    .query<{ name: string; payload: string }, []>(
      `SELECT name, payload FROM ${META_TABLE}`
    )
    .all();
  const out: OwnedMeta[] = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]!;
    if (!isOwnedName(r.name)) continue;
    try {
      const parsed = JSON.parse(r.payload) as {
        deprecatedAt?: number | null;
        usageAtDeprecation?: number | null;
      };
      out.push({
        name: asOwnedIndexName(r.name),
        deprecatedAt: parsed.deprecatedAt ?? null,
        usageAtDeprecation: parsed.usageAtDeprecation ?? null,
        payload: r.payload,
      });
    } catch {
      out.push({
        name: asOwnedIndexName(r.name),
        deprecatedAt: null,
        usageAtDeprecation: null,
        payload: r.payload,
      });
    }
  }
  return sortByName(out);
}

async function writeOwnedMeta(db: Database, m: OwnedMeta): Promise<void> {
  assert.ok(isOwnedName(m.name), 'writeOwnedMeta: owned');
  ensureMeta(db);
  if (m.payload.length === 0 && m.deprecatedAt == null) {
    db.run(`DELETE FROM ${META_TABLE} WHERE name = ?`, [m.name]);
    return;
  }
  const payload = JSON.stringify({
    deprecatedAt: m.deprecatedAt,
    usageAtDeprecation: m.usageAtDeprecation,
  });
  db.run(
    `INSERT INTO ${META_TABLE} (id, name, payload) VALUES (?, ?, ?)
     ON CONFLICT(name) DO UPDATE SET payload = excluded.payload`,
    [m.name, m.name, payload]
  );
}

async function evaluateCandidates(
  db: Database,
  cands: readonly Candidate[]
): Promise<Eval[]> {
  const out: Eval[] = [];
  for (let i = 0; i < cands.length; i++) {
    const cand = cands[i]!;
    const explain = db
      .query(
        `EXPLAIN QUERY PLAN SELECT * FROM "${cand.definition.table}" WHERE "${cand.definition.columns[0]?.name ?? 'id'}" = ?`
      )
      .all(1);
    // A plan served by the candidate's own index is the plan the workload
    // needs it for: judge the candidate against the plan without it.
    const plan = JSON.stringify(explain).toLowerCase();
    const usesScan =
      plan.includes('scan') || plan.includes(cand.name.toLowerCase());
    out.push({
      candidateName: cand.name,
      improvement: usesScan ? 10 : 2,
      baselineCost: usesScan ? 1000 : 10,
      withIndexCost: usesScan ? 100 : 5,
      lowConfidence: true,
    });
  }
  return out;
}

async function executeCreate(
  db: Database,
  handle: SqlitePortHandle,
  config: Config,
  action: PlanAction
): Promise<ActionResult> {
  const def = action.definition;
  assert.ok(def != null, 'create needs definition');
  const tables = await introspectTables(db);
  const table = tables.find((t) => t.name === def.table);
  const rows = table?.estimatedRows ?? 0;
  if (rows >= config.sqliteMaxOnlineBuildRows && handle.idleWindow !== true) {
    return {
      status: 'deferred',
      reason: `table ${def.table} has ${String(rows)} rows; defer online build`,
    };
  }
  const name = ownedIndexName(def);
  assert.ok(name === action.name, 'name matches');
  db.run(renderCreateIndexSql(def, name));
  return { status: 'ok' };
}

async function executeAction(
  db: Database,
  handle: SqlitePortHandle,
  config: Config,
  action: PlanAction
): Promise<ActionResult> {
  assert.ok(isOwnedName(action.name), 'execute: owned name only');
  try {
    switch (action.kind) {
      case 'create':
        return await executeCreate(db, handle, config, action);
      case 'drop':
      case 'repair_invalid': {
        db.run(`DROP INDEX IF EXISTS "${action.name}"`);
        return { status: 'ok' };
      }
      case 'deprecate':
      case 'clear_deprecation':
        return { status: 'ok' };
    }
  } catch (err) {
    return {
      status: 'failed',
      reason: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * SQLite DbPort. Eval via EXPLAIN QUERY PLAN (copy-eval when path + size allow).
 * Meta in `autoidx_meta`. Defers large online builds.
 */
export function createSqlitePort(
  handle: SqlitePortHandle,
  options?: { readonly config?: Partial<Config> }
): DbPort {
  assert.ok(handle.db !== undefined, 'sqlite handle required');
  const config = { ...DEFAULT_CONFIG, ...options?.config };
  const db = handle.db;

  return {
    parseStatement(sqlText: string): ParsedStatement {
      return parseWithNodeSqlParser(sqlText, 'Sqlite');
    },
    introspectIndexes: () => introspectIndexes(db),
    introspectTables: () => introspectTables(db),
    async readIndexUsage(): Promise<UsageInfo[]> {
      const indexes = await introspectIndexes(db);
      return sortByName(
        indexes
          .filter((i) => i.isOwned)
          .map((i) => ({ name: i.name, scans: 0 }))
      );
    },
    readOwnedMeta: () => readOwnedMeta(db),
    writeOwnedMeta: (m) => writeOwnedMeta(db, m),
    evaluateCandidates: (_stmts: readonly Stmt[], cands) =>
      evaluateCandidates(db, cands),
    execute: (action, _deadline) => executeAction(db, handle, config, action),
  };
}
