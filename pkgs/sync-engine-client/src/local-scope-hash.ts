import type { SqlClient } from '@pkgs/sql-client-shared/interface';

import type { MutationEnv } from '@pkgs/sync-engine-shared/mutations-types';
import { DEFAULT_QUERY_LIMIT } from '@pkgs/sync-engine-shared/queries-types';
import type { QueryCtx, QueryDef } from '@pkgs/sync-engine-shared/queries-types';
import type { QueryRow } from '@pkgs/sync-engine-shared/v2';
import { applyHardLimit } from '@pkgs/sync-engine-shared/apply-hard-limit';
import { hashQueryTables } from '@pkgs/sync-engine-shared/canonical';
import { parseStandardSchema } from '@pkgs/sync-engine-shared/standard-schema';

export async function computeLocalScopeHash(args: {
  readonly db: SqlClient;
  readonly query: QueryDef<unknown>;
  readonly params: Readonly<Record<string, unknown>>;
  readonly env: MutationEnv;
}): Promise<string | null> {
  const paramsSchema = args.query.params;
  if (paramsSchema === undefined) return null;
  const parsedResult = await parseStandardSchema(paramsSchema, args.params);
  if (!parsedResult.ok) return null;
  const parsed = parsedResult.value;

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
