import { assert } from '@pkgs/assert';
import {
  fingerprintSql,
  type WorkloadManifest,
  type WorkloadQuery,
  type WorkloadStatement,
} from '@pkgs/db-indexes';
import type { Sql } from '@pkgs/sql';
import type { QueryCtx, QueryDef, QueryRegistry } from '../queries/core/types';
import {
  emptyObjectSchema,
  parseStandardSchema,
  QUERY_PARAM_STUB,
} from './standard-schema';

export type EnvFixture = {
  readonly actorId: string;
  readonly deviceId: string;
  readonly accountId: string | null;
  readonly isAnon: boolean;
};

const DEFAULT_ENV: EnvFixture = {
  actorId: 'actor_workload',
  deviceId: 'device_workload',
  accountId: null,
  isAnon: false,
};

async function stubParams(query: QueryDef<unknown>): Promise<unknown> {
  const schema = query.params ?? emptyObjectSchema;
  const empty = await parseStandardSchema(schema, {});
  if (empty.ok) return empty.value;
  const stubbed = await parseStandardSchema(schema, QUERY_PARAM_STUB);
  return stubbed.ok ? stubbed.value : QUERY_PARAM_STUB;
}

function capturingCtx(env: EnvFixture): {
  readonly ctx: QueryCtx;
  readonly captured: Sql<unknown>[];
} {
  const captured: Sql<unknown>[] = [];
  const ctx: QueryCtx = {
    db: {
      query: async (q) => {
        captured.push(q);
        return [];
      },
    },
    env: {
      actorId: env.actorId,
      deviceId: env.deviceId,
      accountId: env.accountId,
      isAnon: env.isAnon,
      now: () => new Date(0),
    },
  };
  return { ctx, captured };
}

function fingerprintsOf(captured: readonly Sql<unknown>[]): string[] {
  return captured.map((q) => fingerprintSql(q.sql));
}

/**
 * Extract a deterministic {@link WorkloadManifest} from a query registry.
 * Records `ctx.db.query` SQL without executing. Conditional SQL is disallowed:
 * fingerprints must match across env fixtures.
 */
export async function extractWorkload(
  registry: QueryRegistry,
  envFixtures?: readonly EnvFixture[]
): Promise<WorkloadManifest> {
  assert.ok(registry !== undefined, 'registry required');
  const fixtures =
    envFixtures !== undefined && envFixtures.length > 0
      ? envFixtures
      : [DEFAULT_ENV];
  assert.ok(fixtures.length >= 1, 'at least one env fixture');

  const names = Object.keys(registry).sort();
  const queries: WorkloadQuery[] = [];

  for (let ni = 0; ni < names.length; ni++) {
    const name = names[ni]!;
    const query = registry[name];
    assert.ok(query !== undefined, `query ${name} missing`);
    const params = await stubParams(query);

    const runs: {
      readonly fps: string[];
      readonly captured: Sql<unknown>[];
    }[] = [];
    for (let fi = 0; fi < fixtures.length; fi++) {
      const { ctx, captured } = capturingCtx(fixtures[fi]!);
      await query.run(ctx, params);
      runs.push({ fps: fingerprintsOf(captured), captured });
    }

    const primary = runs[0]!;
    if (primary.captured.length === 0) {
      throw new Error(
        `extractWorkload: query "${name}" captured zero statements`
      );
    }
    for (let ri = 1; ri < runs.length; ri++) {
      const other = runs[ri]!;
      if (JSON.stringify(other.fps) !== JSON.stringify(primary.fps)) {
        throw new Error(
          `extractWorkload: query "${name}" fingerprint divergence across env fixtures (conditional SQL is disallowed)`
        );
      }
    }

    const statements: WorkloadStatement[] = primary.captured.map(
      (q, index) => ({
        index,
        sql: q.sql,
        text: q.text,
        fingerprint: fingerprintSql(q.sql),
        weight: 1,
      })
    );

    queries.push({
      name,
      hydrates: [...query.hydrates],
      statements,
    });
  }

  return { version: 1, queries };
}
