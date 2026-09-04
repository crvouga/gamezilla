import { assert } from '@pkgs/assert';
import { type Sql, sql } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { parseStandardSchema } from '../../shared/standard-schema';
import { classify } from '../../sql-ast';
import {
  DEFAULT_QUERY_LIMIT,
  type QueryDef,
  type QueryRegistry,
  type QueryResponse,
  type QueryRow,
} from '../core/types';
import { applyHardLimit } from '../shared/apply-hard-limit';
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
    assert.fail(
      'defineQuery.run must not filter on deleted_at (tombstones must sync)'
    );
  }
  let next: Sql<QueryRow> = query as Sql<QueryRow>;
  if (!classified.hasDeletedAtColumn && !classified.selectsStar) {
    // Inject managed column for explicit column lists.
    next = sql<QueryRow>`SELECT *, deleted_at FROM (${query}) AS _sync_q`;
  }
  if (classified.hasLimit) {
    assert.fail(
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
  const parsedParams = await parseStandardSchema(paramsSchema, input.params);
  if (!parsedParams.ok) {
    return { status: 'denied' };
  }
  const params = parsedParams.value;

  const limit = def.limit ?? DEFAULT_QUERY_LIMIT;

  const env = {
    actorId: deps.auth.actorId,
    deviceId: deps.auth.deviceId,
    accountId: deps.auth.accountId,
    isAnon: deps.auth.isAnon,
    now: deps.auth.now,
  };

  const runCtx = {
    db: {
      query: async (query: Sql<unknown>) => {
        const enforced = enforceReadSql(query, limit);
        return deps.db.query(enforced as Sql<Record<string, unknown>>);
      },
    },
    env,
  };

  // authorize may use auth-scoped reads (including deleted_at filters).
  const authCtx = {
    db: {
      query: (query: Sql<unknown>) =>
        deps.db.query(query as Sql<Record<string, unknown>>),
    },
    env,
  };

  // Default deny-anon unless allowAnon or custom authorize.
  if (def.authorize !== undefined) {
    let ok: boolean;
    try {
      ok = await def.authorize(authCtx, params);
    } catch {
      return { status: 'denied' };
    }
    if (!ok) return { status: 'denied' };
  } else if (def.allowAnon !== true && deps.auth.actorId.length === 0) {
    return { status: 'denied' };
  }

  // Mint before reading: the checkpoint is a lower bound on the snapshot's
  // position. A replay that commits after this mint publishes a higher
  // checkpoint, so a client holding that push rejects this (older) snapshot.
  const checkpoint = deps.nextCheckpoint();
  const tables = await def.run(runCtx, params);
  let total = 0;
  for (const rows of Object.values(tables)) {
    total += rows.length;
  }
  if (
    deps.strictQueryLimits === true &&
    def.limitIsDefault === true &&
    total > limit
  ) {
    throw new QueryLimitExceeded(def.name, limit);
  }
  const limited = applyHardLimit(tables, limit);
  const hash = hashQueryTables(limited);

  if (input.lastHash !== undefined && input.lastHash === hash) {
    return { status: 'not_modified' };
  }

  return {
    status: 'ok',
    checkpoint,
    hash,
    tables: limited,
  };
}
