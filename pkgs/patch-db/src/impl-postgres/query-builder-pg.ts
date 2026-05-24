/**
 * Postgres query-builder facade. Composes the WHERE-clause builder
 * ({@link ./query-builder-pg-where}) and the snapshot/patch/order/limit
 * builder ({@link ./query-builder-pg-snapshot}) and exposes the
 * back-compat entry points the rest of the engine depends on.
 *
 * The split mirrors the runtime layout: {@link ./query-builder-pg-where}
 * is recursion-aware (subqueries) and partition-aware (generated columns),
 * while {@link ./query-builder-pg-snapshot} ties query shape to a
 * concrete `FROM`, alias, and tiebreaker order.
 */
import { assertSqlPrefix } from '@pkgs/sql';
import type { PatchDbQueryWhereClause } from '../interface';
import {
  buildWhereClauseInCtx,
  rootWhereCtx,
  type WhereFragment,
} from './query-builder-pg-where';

export type { WhereFragment, WhereCtx } from './query-builder-pg-where';
export {
  MAX_SUBQUERY_DEPTH,
  buildWhereClauseForColumn,
  buildWhereClauseInCtx,
  rootWhereCtx,
} from './query-builder-pg-where';
export type { PgQueryBuilderOptions } from './query-builder-pg-options';
export type { SnapshotSource } from './query-builder-pg-snapshot';
export {
  buildLimitSQL,
  buildOrderSQL,
  buildPatchConditions,
  buildSnapshotConditions,
  resolveSnapshotSource,
  snapshotSqlIdentifiers,
} from './query-builder-pg-snapshot';

/**
 * Back-compat entry point. Tests call `buildWhereClause(clause)` directly;
 * production callers go through {@link buildSnapshotConditions} /
 * {@link buildPatchConditions}, which thread partition + schema context.
 */
export function buildWhereClause(
  clause: PatchDbQueryWhereClause,
  columnPrefix = ''
): WhereFragment {
  assertSqlPrefix(columnPrefix, 'Invalid column prefix for where clause');
  const jsonColumn = `${columnPrefix}attributes`;
  const ctx = rootWhereCtx(jsonColumn, undefined, undefined, null);
  return buildWhereClauseInCtx(clause, ctx);
}
