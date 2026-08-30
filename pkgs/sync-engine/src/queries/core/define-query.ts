import { assert } from '@pkgs/assert';

import {
  emptyObjectSchema,
  parseStandardSchema,
  QUERY_PARAM_STUB,
} from '../../shared/standard-schema';
import {
  DEFAULT_QUERY_LIMIT,
  type QueryCtx,
  type QueryDef,
  type QueryDefInput,
  type QueryRow,
} from './types';

/**
 * Register a query. `hydrates` is derived from `run` return keys on first
 * execution. `limit` defaults to {@link DEFAULT_QUERY_LIMIT}.
 */
export function defineQuery<P = Record<string, never>>(
  q: QueryDefInput<P>
): QueryDef<P> {
  const limitIsDefault = q.limit === undefined;
  const limit = q.limit ?? DEFAULT_QUERY_LIMIT;
  assert.ok(
    Number.isFinite(limit) && limit > 0,
    `Query ${q.name}: hard limit must be a positive number`
  );
  let resolvedHydrates: string[] | null = null;

  const baseParams =
    q.params ??
    (emptyObjectSchema as unknown as NonNullable<QueryDef<P>['params']>);

  const def: QueryDef<P> = {
    ...q,
    limit,
    limitIsDefault,
    params: baseParams,
    get hydrates() {
      return resolvedHydrates ?? [];
    },
    async run(ctx, params) {
      const tables = await q.run(ctx, params);
      const keys = Object.keys(tables).sort();
      assert.ok(keys.length > 0, `Query ${q.name}: run must return table keys`);
      if (resolvedHydrates === null) {
        resolvedHydrates = keys;
      } else {
        const expected = [...resolvedHydrates].sort().join('\0');
        const got = keys.join('\0');
        assert.ok(
          expected === got,
          `Query ${q.name}: run keys [${keys.join(',')}] !== hydrates [${resolvedHydrates.join(',')}]`
        );
      }
      return tables as Readonly<Record<string, readonly QueryRow[]>>;
    },
  };
  return def;
}

const resolveStubCtx: QueryCtx = {
  db: {
    query: async () => [],
  },
  env: {
    actorId: 'actor_resolve',
    deviceId: 'device_resolve',
    accountId: null,
    isAnon: false,
    now: () => new Date(0),
  },
};

/**
 * Force-resolve `hydrates` by executing `run` against an empty stub DB.
 * Used by channel-exhaustiveness CI (no authoring `hydrates` field).
 */
export async function resolveQueryHydrates(
  query: QueryDef<unknown>
): Promise<readonly string[]> {
  if (query.hydrates.length > 0) return query.hydrates;
  const paramsSchema = query.params ?? emptyObjectSchema;
  const empty = await parseStandardSchema(paramsSchema, {});
  let resolved: unknown;
  if (empty.ok) {
    resolved = empty.value;
  } else {
    const stubbed = await parseStandardSchema(paramsSchema, QUERY_PARAM_STUB);
    resolved = stubbed.ok ? stubbed.value : QUERY_PARAM_STUB;
  }
  await query.run(resolveStubCtx, resolved);
  return query.hydrates;
}
