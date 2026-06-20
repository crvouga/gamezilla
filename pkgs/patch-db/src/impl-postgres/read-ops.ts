import { assert } from '@pkgs/assert';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { assertWhereFragment } from '@pkgs/sql';
import { parseAttributes, toEntity, toPatch } from '../impl-sqlite/mappers';
import type { PatchRow, SnapshotRow } from '../impl-sqlite/types';
import type {
  Entity,
  Patch,
  PatchDbQuery,
  PatchDbResult,
  PatchDbResultMetrics,
} from '../interface';
import { assertExplainHasNoSeqScan } from './explain-guard';
import {
  buildLimitSQL,
  buildOrderSQL,
  buildPatchConditions,
  buildSnapshotConditions,
  snapshotSqlIdentifiers,
  type PgQueryBuilderOptions,
} from './query-builder-pg';
import { readOnePatchBased } from './read-ops-patch-based';
import {
  partitionReadUnits,
  planReadUnits,
  rehydrateReadResults,
} from './read-ops-plan';
import {
  batchFetchPatchesForEntities,
  batchFetchSnapshots,
  computeOrderedEntityKeys,
  hasMoreFromOverFetch,
  rowAttributesText,
  toPatchRow,
  trimToRequestedLimit,
} from './read-ops-shared';

async function maybeAssertNoSeqScan(
  sqlClient: SqlClient,
  sql: string,
  params: readonly unknown[],
  options: PgQueryBuilderOptions | undefined
): Promise<void> {
  const guard = options?.explainGuard;
  if (guard === undefined || guard.mode === 'off') return;
  await assertExplainHasNoSeqScan(sqlClient, sql, params, { mode: guard.mode });
}

function isDefaultEntityView(q: PatchDbQuery): boolean {
  return q.on !== 'patches';
}

function hasBareStringEntityId(q: PatchDbQuery): boolean {
  return (
    typeof q.entityId === 'string' &&
    q.entityType !== undefined &&
    q.entityType !== ''
  );
}

function hasNoWhereOrOrderBy(q: PatchDbQuery): boolean {
  return (
    (q.where === null || q.where === undefined) &&
    (q.orderBy === null || q.orderBy === undefined)
  );
}

/** `knownPatchIds` allowed (sync poll); still rejects `knownPatches` (would need hydration). */
function hasNoKnownPatches(q: PatchDbQuery): boolean {
  const kp = q.knownPatches;
  return kp === null || kp === undefined || kp.length === 0;
}

function hasAtomPaginationDefaults(q: PatchDbQuery): boolean {
  if (q.after !== null && q.after !== undefined) return false;
  if (q.offset !== null && q.offset !== undefined && q.offset !== 0)
    return false;
  if (q.limit !== null && q.limit !== undefined && q.limit !== 1) return false;
  return true;
}

/** Solo snapshot fast-path: same as batchable atom, but allows `knownPatchIds` for SQL pruning. */
function isBareSingleEntityFastPathQuery(q: PatchDbQuery): boolean {
  return (
    isDefaultEntityView(q) &&
    hasBareStringEntityId(q) &&
    hasNoWhereOrOrderBy(q) &&
    hasNoKnownPatches(q) &&
    hasAtomPaginationDefaults(q)
  );
}

async function readBareSingleEntityBatchPostgres(
  sqlClient: SqlClient,
  slice: readonly PatchDbQuery[]
): Promise<PatchDbResult[]> {
  const entityType = slice[0]?.entityType;
  assert.ok(
    entityType !== undefined && entityType !== '',
    'readBareSingleEntityBatchPostgres: entityType required'
  );
  const pairs = slice.map((q) => ({
    entity_id: q.entityId as string,
    entity_type: entityType,
  }));
  const excludePatchIds =
    slice.length === 1 &&
    slice[0]!.knownPatchIds !== undefined &&
    slice[0]!.knownPatchIds.length > 0
      ? slice[0]!.knownPatchIds
      : undefined;
  const allPatches = await batchFetchPatchesForEntities(
    sqlClient,
    pairs,
    excludePatchIds
  );
  const byKey = new Map<string, Patch[]>();
  for (const p of allPatches) {
    const k = `${p.entityId}\0${p.entityType}`;
    let list = byKey.get(k);
    if (list === undefined) {
      list = [];
      byKey.set(k, list);
    }
    list.push(p);
  }

  const keys = slice.map((q) => `${q.entityId as string}\0${entityType}`);
  const entitiesOrdered = await batchFetchSnapshots(sqlClient, keys);
  const entityByKey = new Map<string, Entity>(
    entitiesOrdered.map((e) => [`${e.entityId}\0${e.entityType}`, e])
  );

  return slice.map((query) => {
    const id = query.entityId as string;
    const k = `${id}\0${entityType}`;
    const patchList = byKey.get(k) ?? [];
    const lim = query.limit;
    const overFetched =
      lim === null || lim === undefined
        ? patchList
        : patchList.slice(0, lim + 1);
    const patchesOut = trimToRequestedLimit(overFetched, query);
    const hasMore = hasMoreFromOverFetch(query, overFetched.length);
    const lastPatch = patchesOut[patchesOut.length - 1];
    const nextCursor =
      lastPatch !== null && lastPatch !== undefined ? lastPatch.patchId : null;
    const entityKeysOrdered = computeOrderedEntityKeys(patchesOut);
    const entities = entityKeysOrdered
      .map((key) => entityByKey.get(key))
      .filter((e): e is Entity => e !== undefined);
    return {
      query,
      entities,
      patches: patchesOut,
      hasMore,
      nextCursor,
    };
  });
}

/**
 * Parallel-dispatch read pipeline. Bare-single-entity batches stay
 * intact (they're already one round-trip). Every other query is
 * dispatched in parallel via `Promise.all`, with deterministic sort
 * order so logs / metrics line up across runs. Results are rehydrated
 * to the caller's original input order.
 */
export async function readPatches(
  sqlClient: SqlClient,
  queries: PatchDbQuery[],
  options?: PgQueryBuilderOptions
): Promise<PatchDbResult[]> {
  if (queries.length === 0) return [];
  const results: PatchDbResult[] = new Array(queries.length);
  const { singles, batches } = partitionReadUnits(planReadUnits(queries));

  const batchPromises = batches.map(async (b) => {
    const batchResults = await readBareSingleEntityBatchPostgres(
      sqlClient,
      b.slice
    );
    return { unit: b, batchResults };
  });
  const singlePromises = singles.map(async (s, sortIndex) => {
    const start =
      typeof globalThis.performance !== 'undefined'
        ? globalThis.performance.now()
        : Date.now();
    const result = await readOne(sqlClient, s.query, options);
    const elapsedMs = Math.max(
      0,
      (typeof globalThis.performance !== 'undefined'
        ? globalThis.performance.now()
        : Date.now()) - start
    );
    const withMetrics = await maybeAttachMetrics({
      sqlClient,
      query: s.query,
      result,
      base: { elapsedMs, sortIndex },
      options,
    });
    return { index: s.index, result: withMetrics };
  });

  const [batchOutcomes, singleOutcomes] = await Promise.all([
    Promise.all(batchPromises),
    Promise.all(singlePromises),
  ]);

  rehydrateReadResults(results, batchOutcomes, singleOutcomes);
  return results;
}

/**
 * Attaches per-query metrics when `query.debug === true` (always) or
 * when no debug flag is set but we still want timing in the response —
 * Phase 5 enables timing for every query that goes through the parallel
 * single-query path. Plan capture happens only when the query opts in,
 * since `EXPLAIN (ANALYZE)` is one extra round-trip.
 */
type MetricsCtx = {
  readonly sqlClient: SqlClient;
  readonly query: PatchDbQuery;
  readonly result: PatchDbResult;
  readonly base: { readonly elapsedMs: number; readonly sortIndex: number };
  readonly options: PgQueryBuilderOptions | undefined;
};

async function maybeAttachMetrics(ctx: MetricsCtx): Promise<PatchDbResult> {
  const { sqlClient, query, result, base, options } = ctx;
  if (query.debug !== true) {
    const metrics: PatchDbResultMetrics = {
      elapsedMs: base.elapsedMs,
      sortIndex: base.sortIndex,
    };
    return { ...result, metrics };
  }
  const plan = await captureExplainPlan(sqlClient, query, options);
  const metrics: PatchDbResultMetrics = {
    elapsedMs: base.elapsedMs,
    sortIndex: base.sortIndex,
    ...(plan !== null ? { plan } : {}),
  };
  return { ...result, metrics };
}

type ExplainRow = { readonly 'QUERY PLAN': unknown };

async function captureExplainPlan(
  sqlClient: SqlClient,
  query: PatchDbQuery,
  options: PgQueryBuilderOptions | undefined
): Promise<unknown> {
  // Reconstruct the SQL the same way `readOne` would. We pick whichever
  // path matches `query.on` / shape so the plan reflects the actual
  // execution. ANALYZE re-runs the query — this is dev / debug only.
  const built = buildSqlForExplain(query, options);
  if (built === null) return null;
  try {
    const rows = await sqlClient.query<ExplainRow>(
      `EXPLAIN (FORMAT JSON, ANALYZE, BUFFERS) ${built.sql}`,
      [...built.params]
    );
    if (rows.length === 0) return null;
    const raw = rows[0]?.['QUERY PLAN'];
    if (typeof raw === 'string') {
      try {
        return JSON.parse(raw);
      } catch {
        return raw;
      }
    }
    return raw ?? null;
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : String(error ?? 'unknown EXPLAIN failure'),
    };
  }
}

function buildSqlForExplain(
  query: PatchDbQuery,
  options: PgQueryBuilderOptions | undefined
): { sql: string; params: unknown[] } | null {
  if (query.on === 'patches') {
    const { conditions, params } = buildPatchConditions(query, 'p', options);
    const whereSQL = conditions.join(' AND ');
    const orderSQL = buildOrderSQL(
      query,
      'ORDER BY p.patch_id ASC',
      'p.',
      options
    );
    const limit = buildLimitSQL(query, { overFetch: true });
    const sql = `SELECT p.patch_id, p.entity_id, p.entity_type, p.attributes::text AS attributes,
              p.created_at, p.recorded_at, p.parent_id
       FROM patches p WHERE ${whereSQL} ${orderSQL}${limit.sql}`;
    return { sql, params: [...params, ...limit.params] };
  }
  // Snapshot path: same shape as readOneSnapshotBased.
  const { conditions, params, source } = buildSnapshotConditions(
    query,
    options
  );
  const snapshotIds = snapshotSqlIdentifiers(source);
  const alias: string = snapshotIds.alias;
  const table: string = snapshotIds.table;
  const orderPrefix: string = snapshotIds.orderPrefix;
  const whereSQL = conditions.join(' AND ');
  const orderSQL = buildOrderSQL(
    query,
    `ORDER BY ${alias}.entity_id ASC`,
    orderPrefix,
    options
  );
  const limit = buildLimitSQL(query, { overFetch: true });
  const sql = `SELECT ${alias}.entity_id, ${alias}.entity_type, ${alias}.attributes::text AS attributes FROM ${table} ${alias} WHERE ${whereSQL} ${orderSQL}${limit.sql}`;
  return { sql, params: [...params, ...limit.params] };
}

async function readOne(
  sqlClient: SqlClient,
  query: PatchDbQuery,
  options?: PgQueryBuilderOptions
): Promise<PatchDbResult> {
  if (query.on === 'patches') {
    return readOnePatchesMode(sqlClient, query, options);
  }
  if (isBareSingleEntityFastPathQuery(query)) {
    const batch = await readBareSingleEntityBatchPostgres(sqlClient, [query]);
    const first = batch[0];
    assert.defined(first, 'readOne: bare fast-path must return one result');
    return first;
  }
  const isSingleEntityQuery = typeof query.entityId === 'string';
  const usePatchBasedLogic =
    (query.after !== null && query.after !== undefined) || isSingleEntityQuery;
  if (usePatchBasedLogic) {
    return readOnePatchBased(sqlClient, query, options);
  }
  return readOneSnapshotBased(sqlClient, query, options);
}

async function readOnePatchesMode(
  sqlClient: SqlClient,
  query: PatchDbQuery,
  options?: PgQueryBuilderOptions
): Promise<PatchDbResult> {
  const { conditions, params } = buildPatchConditions(query, 'p');
  const whereSQL = conditions.join(' AND ');

  const orderSQL = buildOrderSQL(
    query,
    'ORDER BY p.patch_id ASC',
    'p.',
    options
  );
  const limit = buildLimitSQL(query, { overFetch: true });

  const sql = `SELECT p.patch_id, p.entity_id, p.entity_type, p.attributes::text AS attributes,
              p.created_at, p.recorded_at, p.parent_id
       FROM patches p WHERE ${whereSQL} ${orderSQL}${limit.sql}`;
  const allParams = [...params, ...limit.params];
  assertWhereFragment(
    { sql, params: allParams },
    { context: 'readOnePatchesMode' }
  );
  await maybeAssertNoSeqScan(sqlClient, sql, allParams, options);
  const rows = await sqlClient.query<PatchRow>(sql, allParams);

  const patches = trimToRequestedLimit(
    rows.map((r) => toPatch(toPatchRow(r))),
    query
  );
  const hasMore = hasMoreFromOverFetch(query, rows.length);
  const lastPatch = patches[patches.length - 1];
  const nextCursor =
    lastPatch !== null && lastPatch !== undefined ? lastPatch.patchId : null;

  const entityKeysOrdered = computeOrderedEntityKeys(patches);
  const entities = await batchFetchSnapshots(sqlClient, entityKeysOrdered);

  return { query, entities, patches, hasMore, nextCursor };
}

async function readOneSnapshotBased(
  sqlClient: SqlClient,
  query: PatchDbQuery,
  options?: PgQueryBuilderOptions
): Promise<PatchDbResult> {
  const { conditions, params, source } = buildSnapshotConditions(
    query,
    options
  );
  const snapshotIds = snapshotSqlIdentifiers(source);
  const alias: string = snapshotIds.alias;
  const table: string = snapshotIds.table;
  const orderPrefix: string = snapshotIds.orderPrefix;
  const whereSQL = conditions.join(' AND ');

  // When `buildSnapshotConditions` resolved to a per-entity standalone
  // table the WHERE clause refers to that table's alias (`s.<col>`);
  // when it stayed on the `snapshots` view, the alias is also `s` so the
  // SELECT shape doesn't change.
  const orderSQL = buildOrderSQL(
    query,
    `ORDER BY ${alias}.entity_id ASC`,
    orderPrefix,
    options
  );
  const limit = buildLimitSQL(query, { overFetch: true });

  const sql = `SELECT ${alias}.entity_id, ${alias}.entity_type, ${alias}.attributes::text AS attributes FROM ${table} ${alias} WHERE ${whereSQL} ${orderSQL}${limit.sql}`;
  const allParams = [...params, ...limit.params];
  assertWhereFragment(
    { sql, params: allParams },
    { context: 'readOneSnapshotBased' }
  );
  await maybeAssertNoSeqScan(sqlClient, sql, allParams, options);
  const rows = await sqlClient.query<SnapshotRow>(sql, allParams);

  const entities = trimToRequestedLimit(
    rows.map((r) => toEntity({ ...r, attributes: rowAttributesText(r) })),
    query
  );
  const hasMore = hasMoreFromOverFetch(query, rows.length);

  const patches = await batchFetchPatchesForEntities(
    sqlClient,
    entities.map((e) => ({ entity_id: e.entityId, entity_type: e.entityType }))
  );

  return { query, entities, patches, hasMore, nextCursor: null };
}

export {
  compareSingleUnits,
  planReadUnits,
  shapeKeyForQuery,
  type ReadUnit,
} from './read-ops-plan';
export { batchFetchSnapshots, parseAttributes, rowAttributesText };
