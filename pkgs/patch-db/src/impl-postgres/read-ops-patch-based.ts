import { assert } from '@pkgs/assert';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { assertWhereFragment } from '@pkgs/sql';
import { toPatch } from '../impl-sqlite/mappers';
import type { PatchRow } from '../impl-sqlite/types';
import type { PatchDbQuery, PatchDbResult } from '../interface';
import { assertExplainHasNoSeqScan } from './explain-guard';
import {
  buildLimitSQL,
  buildOrderSQL,
  buildSnapshotConditions,
  type PgQueryBuilderOptions,
} from './query-builder-pg';
import {
  batchFetchSnapshots,
  computeOrderedEntityKeys,
  hasMoreFromOverFetch,
  toPatchRow,
  trimToRequestedLimit,
} from './read-ops-shared';
import { SELECT_DEPTH_BY_PATCH_ID } from './sql-constants';

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

type LineagePredicates = {
  lineageSeedPredicate: string;
  lineageStepPredicate: string;
  lineageParams: unknown[];
};

const NEVER_MATCH: LineagePredicates = {
  lineageSeedPredicate: '1 = 0',
  lineageStepPredicate: '1 = 0',
  lineageParams: [],
};

const ALWAYS_MATCH: LineagePredicates = {
  lineageSeedPredicate: '1=1',
  lineageStepPredicate: '1=1',
  lineageParams: [],
};

const MATCHING_ENTITIES_PREDICATES: LineagePredicates = {
  lineageSeedPredicate:
    '(entity_id, entity_type) IN (SELECT entity_id, entity_type FROM matching_entities)',
  lineageStepPredicate:
    '(p.entity_id, p.entity_type) IN (SELECT entity_id, entity_type FROM matching_entities)',
  lineageParams: [],
};

function predicatesForEntityIdArray(
  eid: readonly string[],
  entityType: string
): LineagePredicates {
  if (eid.length === 0) return NEVER_MATCH;
  const ph = eid.map(() => '?').join(', ');
  return {
    lineageSeedPredicate: `entity_type = ? AND entity_id IN (${ph})`,
    lineageStepPredicate: `p.entity_type = ? AND p.entity_id IN (${ph})`,
    lineageParams: [entityType, ...eid, entityType, ...eid],
  };
}

function predicatesForEntityIdString(
  eid: string,
  entityType: string
): LineagePredicates {
  return {
    lineageSeedPredicate: 'entity_type = ? AND entity_id = ?',
    lineageStepPredicate: 'p.entity_type = ? AND p.entity_id = ?',
    lineageParams: [entityType, eid, entityType, eid],
  };
}

function predicatesForEntityTypeOnly(entityType: string): LineagePredicates {
  return {
    lineageSeedPredicate: 'entity_type = ?',
    lineageStepPredicate: 'p.entity_type = ?',
    lineageParams: [entityType, entityType],
  };
}

function lineagePredicatesForQuery(query: PatchDbQuery): LineagePredicates {
  const eid = query.entityId;
  const entityType = query.entityType;
  const typeDefined =
    entityType !== null && entityType !== undefined && entityType !== '';
  if (Array.isArray(eid)) {
    assert.ok(typeDefined, 'entityType required when entityId is an array', {
      query,
    });
    return predicatesForEntityIdArray(eid, entityType!);
  }
  if (typeof eid === 'string') {
    assert.ok(typeDefined, 'entityType required when entityId is a string', {
      query,
    });
    return predicatesForEntityIdString(eid, entityType!);
  }
  if (typeDefined) {
    return predicatesForEntityTypeOnly(entityType!);
  }
  return ALWAYS_MATCH;
}

/**
 * Split for patch-based reads: lineage CTE is scoped to matching entities (not the full table);
 * optional `matching_entities` CTE when `where` filters snapshots without a concrete `entityId`.
 */
type LineageCandSplit = {
  useMatchingEntities: boolean;
  snapWhereSQL: string;
  snapParams: unknown[];
  /** Snapshot source table (parent or partition) for the inner SELECT. */
  snapTable: string;
  lineageSeedPredicate: string;
  lineageStepPredicate: string;
  lineageParams: unknown[];
  candConditions: string[];
  candParams: unknown[];
};

function buildLineageCandSplit(
  query: PatchDbQuery,
  snapWhereSQL: string,
  snapParams: unknown[],
  snapTable: string
): LineageCandSplit {
  const hasWhere = query.where !== null && query.where !== undefined;
  const useMatchingEntities = hasWhere && query.entityId === undefined;
  if (useMatchingEntities) {
    return {
      useMatchingEntities: true,
      snapWhereSQL,
      snapParams,
      snapTable,
      ...MATCHING_ENTITIES_PREDICATES,
      candConditions: [],
      candParams: [],
    };
  }
  const candConditions: string[] = [];
  const candParams: unknown[] = [];
  if (hasWhere) {
    candConditions.push(
      `(p.entity_id, p.entity_type) IN (SELECT s.entity_id, s.entity_type FROM ${snapTable} s WHERE ${snapWhereSQL})`
    );
    candParams.push(...snapParams);
  }
  return {
    useMatchingEntities: false,
    snapWhereSQL,
    snapParams,
    snapTable,
    ...lineagePredicatesForQuery(query),
    candConditions,
    candParams,
  };
}

type Cursor = { condition: string; params: unknown[] };

type PatchBasedSqlTail = {
  cursorCondition: string;
  orderSQL: string;
  limitSql: string;
};

function candWhereSql(split: LineageCandSplit): string {
  if (split.candConditions.length > 0)
    return split.candConditions.join(' AND ');
  return '1=1';
}

function buildPatchBasedSql(
  split: LineageCandSplit,
  tail: PatchBasedSqlTail
): string {
  const withPrefix = split.useMatchingEntities
    ? `WITH RECURSIVE matching_entities AS (SELECT s.entity_id, s.entity_type FROM ${split.snapTable} s WHERE ${split.snapWhereSQL}), `
    : `WITH RECURSIVE `;

  const candWhere = candWhereSql(split);

  return `${withPrefix}lineage AS (
    SELECT patch_id, 0 AS depth
    FROM patches
    WHERE parent_id IS NULL AND ${split.lineageSeedPredicate}
    UNION ALL
    SELECT p.patch_id, l.depth + 1
    FROM patches p
    JOIN lineage l ON p.parent_id = l.patch_id
    WHERE ${split.lineageStepPredicate}
),
cand AS (
  SELECT p.patch_id, p.entity_id, p.entity_type, p.attributes::text AS attributes,
         p.created_at, p.recorded_at, p.parent_id, l.depth AS lineage_depth
  FROM patches p
  JOIN lineage l ON p.patch_id = l.patch_id
  WHERE ${candWhere}${tail.cursorCondition}
)
SELECT p.patch_id, p.entity_id, p.entity_type, p.attributes, p.created_at, p.recorded_at, p.parent_id
FROM cand p
${tail.orderSQL}${tail.limitSql}`;
}

function patchBasedParams(
  split: LineageCandSplit,
  cursor: Cursor,
  limit: { sql: string; params: unknown[] }
): unknown[] {
  const head = split.useMatchingEntities ? [...split.snapParams] : [];
  return [
    ...head,
    ...split.lineageParams,
    ...split.candParams,
    ...cursor.params,
    ...limit.params,
  ];
}

async function resolveCursor(
  sqlClient: SqlClient,
  after: string
): Promise<Cursor> {
  const cursorRows = await sqlClient.query<{
    entity_id: string;
    entity_type: string;
    patch_id: string;
  }>(
    'SELECT entity_id, entity_type, patch_id FROM patches WHERE patch_id = ?',
    [after]
  );
  assert.ok(cursorRows.length > 0, 'Cursor patch not found', { after });
  const c = cursorRows[0];
  assert.ok(c !== null && c !== undefined, 'cursorRows[0] must exist', {
    after,
  });
  const depthRows = await sqlClient.query<{ depth: number }>(
    SELECT_DEPTH_BY_PATCH_ID,
    [after]
  );
  const cursorDepth = depthRows[0]?.depth ?? 0;
  return {
    condition:
      ' AND (p.entity_id, p.entity_type, l.depth, p.patch_id) > (?, ?, ?, ?)',
    params: [c.entity_id, c.entity_type, cursorDepth, c.patch_id],
  };
}

export async function readOnePatchBased(
  sqlClient: SqlClient,
  query: PatchDbQuery,
  options?: PgQueryBuilderOptions
): Promise<PatchDbResult> {
  const {
    conditions: snapConditions,
    params: snapParams,
    source,
  } = buildSnapshotConditions(query, options);
  const snapWhereSQL = snapConditions.join(' AND ');

  const split = buildLineageCandSplit(
    query,
    snapWhereSQL,
    snapParams,
    source.table
  );

  const cursor = query.after
    ? await resolveCursor(sqlClient, query.after)
    : { condition: '', params: [] as unknown[] };

  const defaultOrder =
    'ORDER BY p.entity_id ASC, p.entity_type ASC, p.lineage_depth ASC, p.patch_id ASC';
  const orderSQL = buildOrderSQL(query, defaultOrder, 'p.', options);
  const limit = buildLimitSQL(query, { overFetch: true });

  const selectSql = buildPatchBasedSql(split, {
    cursorCondition: cursor.condition,
    orderSQL,
    limitSql: limit.sql,
  });
  const allParams = patchBasedParams(split, cursor, limit);
  assertWhereFragment(
    { sql: selectSql, params: allParams },
    { context: 'readOnePatchBased' }
  );
  await maybeAssertNoSeqScan(sqlClient, selectSql, allParams, options);

  const rows = await sqlClient.query<PatchRow>(selectSql, allParams);

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
