import { assert } from '@pkgs/assert';
import type { Sql } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { ZodError } from 'zod';
import type {
  QueryDef,
  QueryRegistry,
  QueryResponse,
  QueryRow,
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
};

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
  let params: unknown;
  try {
    params = def.params.parse(input.params);
  } catch (e) {
    assert.ok(e instanceof ZodError, 'query params parse failed');
    return { status: 'denied' };
  }

  const ctx = {
    db: {
      query: (query: Sql<unknown>) =>
        deps.db.query(query as Sql<Record<string, unknown>>),
    },
    env: {
      actorId: deps.auth.actorId,
      deviceId: deps.auth.deviceId,
      accountId: deps.auth.accountId,
      isAnon: deps.auth.isAnon,
      now: deps.auth.now,
    },
  };

  if (def.authorize !== undefined) {
    const ok = await def.authorize(ctx, params);
    if (!ok) return { status: 'denied' };
  }

  const tables = await def.run(ctx, params);
  const limited = applyHardLimit(tables, def.limit);
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
  limit: number
): Record<string, QueryRow[]> {
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
