import { assert } from '@pkgs/assert';
import { z } from 'zod';

import {
  DEFAULT_QUERY_LIMIT,
  type QueryCtx,
  type QueryDef,
  type QueryDefInput,
  type QueryRow,
} from './types';

const emptyParams = z.object({});

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
    q.params ?? (emptyParams as unknown as NonNullable<QueryDef<P>['params']>);

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
  const paramsSchema = query.params ?? emptyParams;
  const parsed = paramsSchema.safeParse({});
  const params = parsed.success
    ? parsed.data
    : // Non-empty required params: best-effort defaults for CI resolve.
      (paramsSchema as z.ZodType<unknown>).parse(
        inferLooseDefaults(paramsSchema)
      );
  await query.run(resolveStubCtx, params);
  return query.hydrates;
}

function inferLooseDefaults(schema: z.ZodType<unknown>): unknown {
  if (!(schema instanceof z.ZodObject)) return {};
  const shape = schema.shape as Record<string, z.ZodTypeAny>;
  const out: Record<string, unknown> = {};
  for (const [key, field] of Object.entries(shape)) {
    if (field instanceof z.ZodDefault) {
      const defVal = field._def.defaultValue as unknown;
      out[key] = typeof defVal === 'function' ? defVal() : defVal;
      continue;
    }
    if (field instanceof z.ZodArray) {
      out[key] = ['id_resolve'];
      continue;
    }
    if (field instanceof z.ZodString) {
      out[key] = 'id_resolve';
      continue;
    }
    if (field instanceof z.ZodNumber) {
      out[key] = 0;
      continue;
    }
    if (field instanceof z.ZodOptional || field instanceof z.ZodNullable) {
      continue;
    }
  }
  return out;
}
