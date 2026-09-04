import { assert } from '@pkgs/assert';
import {
  assertIndexableWorkload,
  fingerprintSql,
  type SchemaIndex,
  type WorkloadManifest,
  type WorkloadQuery,
  type WorkloadStatement,
} from '@pkgs/db-indexes';
import type { Sql } from '@pkgs/sql';
import { resolveQueryStubParams } from '../queries/core/define-query';
import type { QueryCtx, QueryDef, QueryRegistry } from '../queries/core/types';
import { classify } from '../sql-ast';

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
  return resolveQueryStubParams(query);
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

    for (let ci = 0; ci < primary.captured.length; ci++) {
      const q = primary.captured[ci]!;
      const classified = classify(q);
      assert.ok(
        classified.kind === 'read',
        `extractWorkload: query "${name}" stmt ${String(ci)} must be a read`,
        { kind: classified.kind }
      );
      const fp = fingerprintSql(q.sql);
      assert.ok(
        fp.length === 64,
        `extractWorkload: query "${name}" stmt ${String(ci)} fingerprint`
      );
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
    for (let si = 0; si < statements.length; si++) {
      assert.ok(
        statements[si]!.index === si,
        `extractWorkload: query "${name}" statement index must be contiguous 0..n-1`
      );
    }

    assert.ok(
      query.hydrates.length > 0,
      `extractWorkload: query "${name}" hydrates empty after run`
    );

    queries.push({
      name,
      hydrates: [...query.hydrates],
      statements,
    });
  }

  return { version: 1, queries };
}

export type AssertQueryRegistryIndexableOpts = {
  readonly schemaIndexes: readonly SchemaIndex[];
  readonly catalogTables: ReadonlySet<string>;
  readonly envFixtures?: readonly EnvFixture[];
};

/**
 * CI gate: extract workload then assert every statement is indexable
 * (PK / schema leftmost / autoidx candidate / catalog allowlist).
 */
export async function assertQueryRegistryIndexable(
  registry: QueryRegistry,
  opts: AssertQueryRegistryIndexableOpts
): Promise<void> {
  assert.ok(registry !== undefined, 'registry required');
  assert.ok(opts !== undefined, 'opts required');
  assert.ok(Array.isArray(opts.schemaIndexes), 'schemaIndexes array');
  assert.ok(opts.catalogTables !== undefined, 'catalogTables required');
  const manifest = await extractWorkload(registry, opts.envFixtures);
  assertIndexableWorkload({
    manifest,
    schemaIndexes: opts.schemaIndexes,
    catalogTables: opts.catalogTables,
  });
}
