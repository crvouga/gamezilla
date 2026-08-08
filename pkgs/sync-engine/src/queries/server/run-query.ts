import { assert } from '@pkgs/assert';
import { type Sql, sql } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { ZodError } from 'zod';
import { classify } from '../../sql-ast';
import {
  DEFAULT_QUERY_LIMIT,
  type QueryDef,
  type QueryRegistry,
  type QueryResponse,
  type QueryRow,
} from '../core/types';
import { hashQueryTables } from '../shared/canonical';

export type RunQueryInput = {
  readonly name: string;
  readonly params: unknown;
  readonly lastHash?: string | undefined;
  readonly checkpoint?: string | undefined;
};

export type RunQueryAuth = {
  readonly actorId: string;
  readonly deviceId: string;
  readonly accountId: string | null;
  readonly isAnon: boolean;
  readonly now: () => Date;
};

export type RunQueryDeps = {
  readonly db: Pick<SqlClient, 'query'>;
  readonly registry: QueryRegistry;
  readonly auth: RunQueryAuth;
  /** Opaque monotonic token per response. */
  readonly nextCheckpoint: () => string;
  /**
   * When true, clipping a snapshot to the query limit throws instead of
   * silently truncating (sim + SECRETS_ENV=dev).
   */
  readonly strictQueryLimits?: boolean;
};

export class QueryLimitExceeded extends Error {
  readonly queryName: string;
  readonly limit: number;

  constructor(queryName: string, limit: number) {
    super(
      `QueryLimitExceeded: query "${queryName}" exceeded hard limit ${String(limit)}`
    );
    this.name = 'QueryLimitExceeded';
    this.queryName = queryName;
    this.limit = limit;
  }
}

function enforceReadSql(query: Sql<unknown>, limit: number): Sql<QueryRow> {
  const classified = classify(query);
  if (classified.kind !== 'read') {
    return query as Sql<QueryRow>;
  }
  if (classified.hasDeletedAtPredicate) {
    throw new Error(
      'defineQuery.run must not filter on _deleted_at (tombstones must sync)'
    );
  }
  let next: Sql<QueryRow> = query as Sql<QueryRow>;
  if (!classified.hasDeletedAtColumn && !classified.selectsStar) {
    // Inject managed column for explicit column lists.
    next = sql<QueryRow>`SELECT *, _deleted_at FROM (${query}) AS _sync_q`;
  }
  if (classified.hasLimit) {
    throw new Error(
      'defineQuery.run must not include inline LIMIT; use the query limit field'
    );
  }
  next = sql<QueryRow>`${next} LIMIT ${limit}`;
  return next;
}

export async function runQuery(
  deps: RunQueryDeps,
  input: RunQueryInput
): Promise<QueryResponse> {
  const def = deps.registry[input.name];
  if (def === undefined) {
    return { status: 'denied' };
  }
  return runDefinedQuery(deps, def, input);
}

async function runDefinedQuery(
  deps: RunQueryDeps,
  def: QueryDef<unknown>,
  input: RunQueryInput
): Promise<QueryResponse> {
  const paramsSchema = def.params;
  assert.defined(paramsSchema, `Query ${def.name}: params schema missing`);
  let params: unknown;
  try {
    params = paramsSchema.parse(input.params);
  } catch (e) {
    assert.ok(e instanceof ZodError, 'query params parse failed');
    return { status: 'denied' };
  }

  const limit = def.limit ?? DEFAULT_QUERY_LIMIT;

  const ctx = {
    db: {
      query: async (query: Sql<unknown>) => {
        const enforced = enforceReadSql(query, limit);
        return deps.db.query(enforced as Sql<Record<string, unknown>>);
      },
    },
    env: {
      actorId: deps.auth.actorId,
      deviceId: deps.auth.deviceId,
      accountId: deps.auth.accountId,
      isAnon: deps.auth.isAnon,
      now: deps.auth.now,
    },
  };

  // Default deny-anon unless allowAnon or custom authorize.
  if (def.authorize !== undefined) {
    let ok: boolean;
    try {
      ok = await def.authorize(ctx, params);
    } catch {
      return { status: 'denied' };
    }
    if (!ok) return { status: 'denied' };
  } else if (def.allowAnon !== true && deps.auth.actorId.length === 0) {
    return { status: 'denied' };
  }

  const tables = await def.run(ctx, params);
  const limited = applyHardLimit(
    tables,
    limit,
    def.name,
    deps.strictQueryLimits === true && def.limitIsDefault === true
  );
  const hash = hashQueryTables(limited);

  if (input.lastHash !== undefined && input.lastHash === hash) {
    return { status: 'not_modified' };
  }

  return {
    status: 'ok',
    checkpoint: deps.nextCheckpoint(),
    hash,
    tables: limited,
  };
}

function applyHardLimit(
  tables: Readonly<Record<string, readonly QueryRow[]>>,
  limit: number,
  queryName: string,
  strict: boolean
): Record<string, QueryRow[]> {
  let total = 0;
  for (const rows of Object.values(tables)) {
    total += rows.length;
  }
  if (strict && total > limit) {
    throw new QueryLimitExceeded(queryName, limit);
  }

  const out: Record<string, QueryRow[]> = {};
  let remaining = limit;
  for (const [name, rows] of Object.entries(tables)) {
    if (remaining <= 0) {
      out[name] = [];
      continue;
    }
    out[name] = rows.slice(0, remaining).map((r) => ({ ...r }));
    remaining -= out[name].length;
  }
  return out;
}
