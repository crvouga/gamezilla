import { assert } from '@gamezilla/lib/assert';
import type { PatchDb, PatchDbQuery, PatchDbResult } from '../interface';
import { OPEN_PATCHES_DB_CONTEXT } from '../interface';
import type { ActiveQuery } from './active-query-registry';

function stripPagination(query: PatchDbQuery): PatchDbQuery {
  const { limit: _limit, offset: _offset, ...rest } = query;
  return rest;
}

function queryNeedsTrackedEntityRead(query: PatchDbQuery): boolean {
  return (
    query.where !== null &&
    query.where !== undefined &&
    query.entityType !== null &&
    query.entityType !== undefined
  );
}

function collectTrackedQueries(
  entries: ActiveQuery[],
  firstPassResults: PatchDbResult[]
): { trackedQueries: PatchDbQuery[]; trackedSourceIndex: number[] } {
  const trackedQueries: PatchDbQuery[] = [];
  const trackedSourceIndex: number[] = [];
  for (let i = 0; i < entries.length; i++) {
    const query = entries[i]?.query;
    const localResult = firstPassResults[i];
    assert.defined(query, 'entry must have query');
    assert.defined(localResult, 'firstPassResults[i] must exist');
    if (!queryNeedsTrackedEntityRead(query)) continue;
    const entityIds = [...new Set(localResult.patches.map((p) => p.entityId))];
    if (entityIds.length === 0) continue;
    const entityType = query.entityType;
    assert.defined(entityType, 'tracked query must have entityType');
    trackedQueries.push({
      entityType,
      entityId: entityIds,
    });
    trackedSourceIndex.push(i);
  }
  return { trackedQueries, trackedSourceIndex };
}

function mapTrackedResultsBySourceIndex(
  trackedSourceIndex: readonly number[],
  trackedResults: readonly PatchDbResult[]
): Map<number, PatchDbResult> {
  const trackedBySource = new Map<number, PatchDbResult>();
  for (let t = 0; t < trackedSourceIndex.length; t++) {
    const src = trackedSourceIndex[t];
    const tr = trackedResults[t];
    assert.defined(src, 'trackedSourceIndex[t] must exist');
    assert.defined(tr, 'trackedResults[t] must exist');
    trackedBySource.set(src, tr);
  }
  return trackedBySource;
}

function stitchSyncQueriesFromPollPasses(
  entries: ActiveQuery[],
  firstPassResults: PatchDbResult[],
  trackedBySource: ReadonlyMap<number, PatchDbResult>
): PatchDbQuery[] {
  const syncQueries: PatchDbQuery[] = [];
  for (let i = 0; i < entries.length; i++) {
    const query = entries[i]!.query;
    const { limit: _limit, offset: _offset, ...queryWithoutPagination } = query;
    const localResult = firstPassResults[i];
    assert.defined(localResult, 'localResult must exist');
    syncQueries.push({
      ...queryWithoutPagination,
      knownPatches: localResult.patches,
    });
    const tracked = trackedBySource.get(i);
    if (tracked === undefined) continue;
    const entityIds = [...new Set(localResult.patches.map((p) => p.entityId))];
    if (entityIds.length === 0) continue;
    syncQueries.push({
      entityType: query.entityType!,
      entityId: entityIds,
      knownPatches: tracked.patches,
    });
  }
  return syncQueries;
}

export async function buildSyncQueriesForPoll(
  local: PatchDb,
  entries: ActiveQuery[]
): Promise<PatchDbQuery[]> {
  if (entries.length === 0) return [];

  const firstPassQueries = entries.map(({ query }) => stripPagination(query));
  const firstPassResults = await local.read(
    firstPassQueries,
    OPEN_PATCHES_DB_CONTEXT
  );
  assert.ok(
    firstPassResults.length === entries.length,
    'buildSyncQueriesForPoll: first pass must return one result per entry',
    {
      expected: entries.length,
      actual: firstPassResults.length,
    }
  );

  const { trackedQueries, trackedSourceIndex } = collectTrackedQueries(
    entries,
    firstPassResults
  );

  let trackedResults: PatchDbResult[] = [];
  if (trackedQueries.length > 0) {
    trackedResults = await local.read(
      trackedQueries,
      OPEN_PATCHES_DB_CONTEXT
    );
    assert.ok(
      trackedResults.length === trackedQueries.length,
      'buildSyncQueriesForPoll: tracked pass must return one result per tracked query',
      {
        expected: trackedQueries.length,
        actual: trackedResults.length,
      }
    );
  }

  const trackedBySource = mapTrackedResultsBySourceIndex(
    trackedSourceIndex,
    trackedResults
  );
  return stitchSyncQueriesFromPollPasses(
    entries,
    firstPassResults,
    trackedBySource
  );
}
