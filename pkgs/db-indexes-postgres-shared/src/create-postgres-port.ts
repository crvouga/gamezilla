import { assert } from '@pkgs/assert-shared/singleton';
import type { Clock } from '@pkgs/clock-shared/types';
import { sortByName } from '@pkgs/db-indexes-shared/compare';
import type { Config } from '@pkgs/db-indexes-shared/config';
import { DEFAULT_CONFIG } from '@pkgs/db-indexes-shared/config';
import { isOwnedName, ownedIndexName } from '@pkgs/db-indexes-shared/naming';
import { parseWithNodeSqlParser } from '@pkgs/db-indexes-shared/parse-node-sql';
import type {
  ActionResult,
  Candidate,
  DbPort,
  Eval,
  IndexInfo,
  OwnedMeta,
  ParsedStatement,
  PlanAction,
  Stmt,
  TableInfo,
  UsageInfo,
} from '@pkgs/db-indexes-shared/types';
import { asOwnedIndexName } from '@pkgs/db-indexes-shared/types';
import { unsafe } from '@pkgs/sql-shared/sql';
import type { SqlClient } from '@pkgs/sql-client-shared/interface';
import {
  isConcurrentlyUnsupportedError,
  renderCreateIndexSql,
  renderDropIndexSql,
} from './render-ddl';

function parseCommentMeta(comment: string | null): OwnedMeta | null {
  if (comment == null || comment.length === 0) return null;
  try {
    const parsed = JSON.parse(comment) as {
      name?: string;
      deprecatedAt?: number | null;
      usageAtDeprecation?: number | null;
    };
    if (typeof parsed.name !== 'string' || !isOwnedName(parsed.name)) {
      return null;
    }
    return {
      name: asOwnedIndexName(parsed.name),
      deprecatedAt: parsed.deprecatedAt ?? null,
      usageAtDeprecation: parsed.usageAtDeprecation ?? null,
      payload: comment,
    };
  } catch {
    return null;
  }
}

function extractTotalCost(rows: readonly Record<string, unknown>[]): number {
  if (rows.length === 0) return 1;
  const plan = rows[0]!['QUERY PLAN'];
  const json = typeof plan === 'string' ? (JSON.parse(plan) as unknown) : plan;
  if (!Array.isArray(json) || json.length === 0) return 1;
  const root = json[0] as { Plan?: { 'Total Cost'?: number } };
  const cost = root.Plan?.['Total Cost'];
  return typeof cost === 'number' && cost > 0 ? cost : 1;
}

async function introspectIndexes(client: SqlClient): Promise<IndexInfo[]> {
  const rows = await client.query(
    unsafe<{
      indexname: string;
      tablename: string;
      indexdef: string;
      indisunique: boolean;
      indisprimary: boolean;
      indisvalid: boolean;
    }>(`
      SELECT
        i.relname AS indexname,
        t.relname AS tablename,
        pg_get_indexdef(i.oid) AS indexdef,
        ix.indisunique,
        ix.indisprimary,
        ix.indisvalid
      FROM pg_index ix
      JOIN pg_class i ON i.oid = ix.indexrelid
      JOIN pg_class t ON t.oid = ix.indrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      WHERE n.nspname = current_schema()
        AND t.relkind = 'r'
      ORDER BY i.relname
    `)
  );
  return sortByName(
    rows.map((r) => {
      const owned = isOwnedName(r.indexname);
      const m = /\(([^)]+)\)/.exec(r.indexdef);
      const columns =
        m?.[1]
          ?.split(',')
          .map((c) => c.trim().replace(/"/g, '').split(' ')[0]!)
          .filter(Boolean) ?? [];
      return {
        name: r.indexname,
        table: r.tablename,
        columns,
        include: [],
        predicate: null,
        isUnique: r.indisunique,
        isPrimary: r.indisprimary,
        isValid: r.indisvalid,
        isOwned: owned,
      };
    })
  );
}

async function introspectTables(client: SqlClient): Promise<TableInfo[]> {
  const rows = await client.query(
    unsafe<{ relname: string; n_live_tup: number }>(`
      SELECT c.relname, COALESCE(s.n_live_tup, 0)::bigint AS n_live_tup
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      LEFT JOIN pg_stat_user_tables s ON s.relid = c.oid
      WHERE n.nspname = current_schema() AND c.relkind = 'r'
      ORDER BY c.relname
    `)
  );
  return sortByName(
    rows.map((r) => ({
      name: r.relname,
      estimatedRows: Number(r.n_live_tup),
    }))
  );
}

async function readIndexUsage(client: SqlClient): Promise<UsageInfo[]> {
  const rows = await client.query(
    unsafe<{ indexrelname: string; idx_scan: number }>(`
      SELECT indexrelname, COALESCE(idx_scan, 0)::bigint AS idx_scan
      FROM pg_stat_user_indexes
      ORDER BY indexrelname
    `)
  );
  return sortByName(
    rows.map((r) => ({
      name: r.indexrelname,
      scans: Number(r.idx_scan),
    }))
  );
}

async function readOwnedMeta(client: SqlClient): Promise<OwnedMeta[]> {
  const rows = await client.query(
    unsafe<{ indexname: string; description: string | null }>(`
      SELECT i.relname AS indexname, d.description
      FROM pg_class i
      JOIN pg_index ix ON ix.indexrelid = i.oid
      LEFT JOIN pg_description d ON d.objoid = i.oid AND d.objsubid = 0
      WHERE i.relname LIKE 'autoidx_%'
      ORDER BY i.relname
    `)
  );
  const out: OwnedMeta[] = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]!;
    if (!isOwnedName(r.indexname)) continue;
    const parsed = parseCommentMeta(r.description);
    if (parsed != null) {
      out.push(parsed);
    } else {
      out.push({
        name: asOwnedIndexName(r.indexname),
        deprecatedAt: null,
        usageAtDeprecation: null,
        payload: r.description ?? '{}',
      });
    }
  }
  return sortByName(out);
}

async function writeOwnedMeta(client: SqlClient, m: OwnedMeta): Promise<void> {
  assert.ok(isOwnedName(m.name), 'writeOwnedMeta: owned');
  if (m.payload.length === 0 && m.deprecatedAt == null) {
    await client.run(unsafe(`COMMENT ON INDEX "${m.name}" IS NULL`));
    return;
  }
  const payload = JSON.stringify({
    name: m.name,
    deprecatedAt: m.deprecatedAt,
    usageAtDeprecation: m.usageAtDeprecation,
  });
  await client.run(
    unsafe(`COMMENT ON INDEX "${m.name}" IS '${payload.replace(/'/g, "''")}'`)
  );
}

function lowConfidenceEval(cand: Candidate): Eval {
  return {
    candidateName: cand.name,
    improvement: 1,
    baselineCost: 1,
    withIndexCost: 1,
    lowConfidence: true,
  };
}

async function evaluateOne(
  client: SqlClient,
  cand: Candidate,
  stmts: readonly Stmt[]
): Promise<Eval> {
  const explainSql =
    stmts[0]?.text ??
    stmts[0]?.sql ??
    `SELECT 1 FROM "${cand.definition.table}" WHERE false`;
  try {
    const baselineRows = await client.query(
      unsafe<{ ['QUERY PLAN']: unknown }>(`EXPLAIN (FORMAT JSON) ${explainSql}`)
    );
    const hypoDdl = renderCreateIndexSql(
      cand.definition,
      cand.name,
      false
    ).replace(/'/g, "''");
    await client.run(unsafe(`SELECT hypopg_create_index('${hypoDdl}')`));
    const withRows = await client.query(
      unsafe<{ ['QUERY PLAN']: unknown }>(`EXPLAIN (FORMAT JSON) ${explainSql}`)
    );
    await client.run(unsafe('SELECT hypopg_reset()'));
    const baselineCost = extractTotalCost(baselineRows);
    const withCost = extractTotalCost(withRows);
    const improvement = withCost > 0 ? baselineCost / withCost : baselineCost;
    return {
      candidateName: cand.name,
      improvement,
      baselineCost,
      withIndexCost: withCost,
      lowConfidence: false,
    };
  } catch {
    await client.run(unsafe('SELECT hypopg_reset()')).catch(() => {});
    return lowConfidenceEval(cand);
  }
}

async function evaluateCandidates(
  client: SqlClient,
  ensureHypopg: () => Promise<boolean>,
  stmts: readonly Stmt[],
  cands: readonly Candidate[]
): Promise<Eval[]> {
  const hypopgOk = await ensureHypopg();
  const out: Eval[] = [];
  if (!hypopgOk) {
    for (let i = 0; i < cands.length; i++) {
      out.push(lowConfidenceEval(cands[i]!));
    }
    return out;
  }
  for (let i = 0; i < cands.length; i++) {
    out.push(await evaluateOne(client, cands[i]!, stmts));
  }
  return out;
}

async function runCreateOrDrop(
  client: SqlClient,
  action: PlanAction
): Promise<void> {
  switch (action.kind) {
    case 'create': {
      const def = action.definition!;
      const name = ownedIndexName(def);
      assert.ok(name === action.name, 'name matches definition');
      try {
        await client.run(unsafe(renderCreateIndexSql(def, name, true)));
      } catch (err) {
        if (!isConcurrentlyUnsupportedError(err)) throw err;
        await client.run(unsafe(renderCreateIndexSql(def, name, false)));
      }
      return;
    }
    case 'drop':
    case 'repair_invalid': {
      try {
        await client.run(unsafe(renderDropIndexSql(action.name, true)));
      } catch (err) {
        if (!isConcurrentlyUnsupportedError(err)) throw err;
        await client.run(unsafe(renderDropIndexSql(action.name, false)));
      }
      return;
    }
    case 'deprecate':
    case 'clear_deprecation':
      return;
  }
}

async function executeAction(
  client: SqlClient,
  clock: Clock,
  action: PlanAction,
  deadline: number
): Promise<ActionResult> {
  assert.ok(isOwnedName(action.name), 'execute: owned name only');
  assert.ok(
    !(action.kind === 'create' && action.definition == null),
    'create needs definition'
  );
  const remaining = Math.max(1, deadline - clock.now());
  try {
    await client.run(unsafe(`SET lock_timeout = '2s'`));
    await client.run(unsafe(`SET statement_timeout = '${String(remaining)}'`));
    await runCreateOrDrop(client, action);
    return { status: 'ok' };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/lock_timeout|canceling statement|timeout/i.test(msg)) {
      return { status: 'deferred', reason: msg };
    }
    return { status: 'failed', reason: msg };
  } finally {
    await client.run(unsafe(`SET lock_timeout = DEFAULT`)).catch(() => {});
    await client.run(unsafe(`SET statement_timeout = DEFAULT`)).catch(() => {});
  }
}

/**
 * Postgres DbPort: hypopg + EXPLAIN for eval; CREATE INDEX CONCURRENTLY for builds
 * (falls back without CONCURRENTLY on pooler/transaction errors). Meta via
 * COMMENT ON INDEX JSON. hypopg is optional — missing extension yields
 * low-confidence evals so migrate-complete can still create indexes.
 */
export function createPostgresPort(
  client: SqlClient,
  options: {
    readonly clock: Clock;
    readonly config?: Partial<Config>;
  }
): DbPort {
  assert.ok(client !== undefined, 'sql client required');
  assert.ok(options.clock !== undefined, 'clock required');
  const clock = options.clock;
  const _config = { ...DEFAULT_CONFIG, ...options.config };
  void _config;
  let hypopgReady: Promise<boolean> | null = null;

  async function ensureHypopg(): Promise<boolean> {
    if (hypopgReady != null) return hypopgReady;
    hypopgReady = (async () => {
      try {
        const available = await client.query(
          unsafe<{ default_version: string | null }>(
            `SELECT default_version FROM pg_available_extensions WHERE name = 'hypopg'`
          )
        );
        if (available.length === 0) return false;
        await client.run(unsafe('CREATE EXTENSION IF NOT EXISTS hypopg'));
        const rows = await client.query(
          unsafe<{ extname: string }>(
            `SELECT extname FROM pg_extension WHERE extname = 'hypopg'`
          )
        );
        return rows.length === 1;
      } catch {
        return false;
      }
    })();
    return hypopgReady;
  }

  return {
    parseStatement(sqlText: string): ParsedStatement {
      // Normalized workload SQL uses `?`. Prefer Postgres after rewrite; fall
      // back to Sqlite when product identifiers are Postgres-reserved (e.g. `at`).
      const pg = parseWithNodeSqlParser(sqlText, 'PostgreSQL');
      if (pg.ok) return pg;
      return parseWithNodeSqlParser(sqlText, 'Sqlite');
    },
    introspectIndexes: () => introspectIndexes(client),
    introspectTables: () => introspectTables(client),
    readIndexUsage: () => readIndexUsage(client),
    readOwnedMeta: () => readOwnedMeta(client),
    writeOwnedMeta: (m) => writeOwnedMeta(client, m),
    evaluateCandidates: (stmts, cands) =>
      evaluateCandidates(client, ensureHypopg, stmts, cands),
    execute: (action, deadline) =>
      executeAction(client, clock, action, deadline),
  };
}
