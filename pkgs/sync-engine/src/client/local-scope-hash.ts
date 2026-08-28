import type { SqlClient } from '@pkgs/sql-client/interface';

import type { MutationEnv } from '../mutations/core/types';
import {
  DEFAULT_QUERY_LIMIT,
  type QueryCtx,
  type QueryDef,
  type QueryRow,
} from '../queries/core/types';
import { applyHardLimit } from '../queries/shared/apply-hard-limit';
import { hashQueryTables } from '../queries/shared/canonical';

export async function computeLocalScopeHash(args: {
  readonly db: SqlClient;
  readonly query: QueryDef<unknown>;
  readonly params: Readonly<Record<string, unknown>>;
  readonly env: MutationEnv;
}): Promise<string | null> {
  const paramsSchema = args.query.params;
  if (paramsSchema === undefined) return null;
  let parsed: unknown;
  try {
    parsed = paramsSchema.parse(args.params);
  } catch {
    return null;
  }

  const ctx: QueryCtx = {
    db: {
      query: (query) => args.db.query(query as never) as Promise<QueryRow[]>,
    },
    env: {
      actorId: args.env.actorId,
      deviceId: args.env.deviceId,
      accountId: args.env.accountId,
      isAnon: args.env.isAnon,
      now: args.env.now,
    },
  };

  let tables: Readonly<Record<string, readonly QueryRow[]>>;
  try {
    tables = await args.query.run(ctx, parsed);
  } catch {
    return null;
  }

  const limit = args.query.limit ?? DEFAULT_QUERY_LIMIT;
  const limited = applyHardLimit(tables, limit);
  return hashQueryTables(limited);
}
