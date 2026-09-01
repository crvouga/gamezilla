import { assert } from '@pkgs/assert';
import type { Clock } from '@pkgs/clock';
import { unsafe } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';
import type { Config } from '../core/config';
import { DEFAULT_CONFIG } from '../core/config';
import { isOwnedName, ownedIndexName } from '../core/naming';
import { parseWithNodeSqlParser } from '../core/parse-node-sql';
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
} from '../core/types';
import { asOwnedIndexName } from '../core/types';

function renderCreateIndexSql(def: IndexDefinition, name: string): string {
  assert.ok(isOwnedName(name), 'render: owned name');
  const cols = def.columns
    .map((c) => `"${c.name}" ${c.order.toUpperCase()}`)
    .join(', ');
  const include =
    def.include.length > 0
      ? ` INCLUDE (${def.include.map((c) => `"${c}"`).join(', ')})`
      : '';
  const pred = def.predicate != null ? ` WHERE ${def.predicate}` : '';
  return `CREATE INDEX CONCURRENTLY IF NOT EXISTS "${name}" ON "${def.table}" (${cols})${include}${pred}`;
}

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
    `)
  );
  return rows.map((r) => {
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
  });
}

async function introspectTables(client: SqlClient): Promise<TableInfo[]> {
  const rows = await client.query(
    unsafe<{ relname: string; n_live_tup: number }>(`
      SELECT c.relname, COALESCE(s.n_live_tup, 0)::bigint AS n_live_tup
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      LEFT JOIN pg_stat_user_tables s ON s.relid = c.oid
      WHERE n.nspname = current_schema() AND c.relkind = 'r'
    `)
  );
  return rows.map((r) => ({
    name: r.relname,
    estimatedRows: Number(r.n_live_tup),
  }));
}

async function readIndexUsage(client: SqlClient): Promise<UsageInfo[]> {
  const rows = await client.query(
    unsafe<{ indexrelname: string; idx_scan: number }>(`
      SELECT indexrelname, COALESCE(idx_scan, 0)::bigint AS idx_scan
      FROM pg_stat_user_indexes
    `)
  );
  return rows.map((r) => ({
    name: r.indexrelname,
    scans: Number(r.idx_scan),
  }));
}

async function readOwnedMeta(client: SqlClient): Promise<OwnedMeta[]> {
  const rows = await client.query(
    unsafe<{ indexname: string; description: string | null }>(`
      SELECT i.relname AS indexname, d.description
      FROM pg_class i
      JOIN pg_index ix ON ix.indexrelid = i.oid
      LEFT JOIN pg_description d ON d.objoid = i.oid AND d.objsubid = 0
      WHERE i.relname LIKE 'autoidx_%'
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
  return out;
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
    const hypoDdl = renderCreateIndexSql(cand.definition, cand.name)
      .replace(/CONCURRENTLY IF NOT EXISTS /, '')
      .replace(/'/g, "''");
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
    return {
      candidateName: cand.name,
      improvement: 1,
      baselineCost: 1,
      withIndexCost: 1,
      lowConfidence: true,
    };
  }
}

async function evaluateCandidates(
  client: SqlClient,
  ensureHypopg: () => Promise<void>,
  stmts: readonly Stmt[],
  cands: readonly Candidate[]
): Promise<Eval[]> {
  await ensureHypopg();
  const out: Eval[] = [];
  for (let i = 0; i < cands.length; i++) {
    out.push(await evaluateOne(client, cands[i]!, stmts));
  }
  return out;
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
    switch (action.kind) {
      case 'create': {
        const def = action.definition!;
        const name = ownedIndexName(def);
        assert.ok(name === action.name, 'name matches definition');
        await client.run(unsafe(renderCreateIndexSql(def, name)));
        return { status: 'ok' };
      }
      case 'drop':
      case 'repair_invalid': {
        await client.run(
          unsafe(`DROP INDEX CONCURRENTLY IF EXISTS "${action.name}"`)
        );
        return { status: 'ok' };
      }
      case 'deprecate':
      case 'clear_deprecation':
        return { status: 'ok' };
    }
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
 * Postgres DbPort: hypopg + EXPLAIN for eval; CREATE INDEX CONCURRENTLY for builds.
 * Meta via COMMENT ON INDEX JSON. Inject {@link Clock} for statement_timeout.
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
  let hypopgReady: Promise<void> | null = null;

  async function ensureHypopg(): Promise<void> {
    if (hypopgReady != null) return hypopgReady;
    hypopgReady = (async () => {
      await client.run(unsafe('CREATE EXTENSION IF NOT EXISTS hypopg'));
      const rows = await client.query(
        unsafe<{ extname: string }>(
          `SELECT extname FROM pg_extension WHERE extname = 'hypopg'`
        )
      );
      assert.ok(
        rows.length === 1,
        'hypopg extension required but not available'
      );
    })();
    return hypopgReady;
  }

  return {
    parseStatement(sqlText: string): ParsedStatement {
      return parseWithNodeSqlParser(sqlText, 'PostgreSQL');
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
