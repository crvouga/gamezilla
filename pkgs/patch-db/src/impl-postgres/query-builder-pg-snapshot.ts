/**
 * Snapshot- / patch- / order- / limit- builders that compose the
 * clause-level builders in {@link ./query-builder-pg}. Lives in its own file
 * so the main builder stays under the Tiger-style file-size cap.
 */
import { assert } from '@pkgs/assert';
import type { DataType } from '@pkgs/attribute';
import {
  assertOffsetLimitFragment,
  assertOrderByFragment,
  assertSqlIdentifier,
  assertSqlPrefix,
} from '@pkgs/sql';
import type { AttributeKey, PatchDbQuery, PatchEntityType } from '../interface';
import { assertDirection, patchDbAttributeKey } from '../interface';
import { sqliteJsonPathToKey } from './json-path';
import { isNumericIndexDataType } from './numeric-data-type';
import {
  type GeneratedColumnSpec,
  UNREGISTERED_SNAPSHOT_TABLE,
} from './partitioning';
import type { PgQueryBuilderOptions } from './query-builder-pg-options';
import {
  buildWhereClauseForColumn,
  jsonPathForAttribute,
  rootWhereCtx,
} from './query-builder-pg-where';

export type { PgQueryBuilderOptions };

export type SnapshotSource = {
  /** Bare table name; safe to interpolate after `assertSqlIdentifier`.
   *  Either the per-entity standalone table `snapshots__<slug>` (when
   *  the query's entity type is known and registered) or the `snapshots`
   *  view (for cross-entity / bare-id reads). */
  readonly table: string;
  /** Alias used in the SELECT (always `s`). */
  readonly alias: string;
  /** When `true`, the resolved `table` is a per-entity standalone table
   *  carrying typed generated columns — queries can use `s.<gen_col>`
   *  directly. When `false`, the source is the `snapshots` UNION ALL
   *  view, which exposes only `(entity_id, entity_type, attributes)`
   *  and falls back to JSONB extracts for typed comparisons. */
  readonly hasTypedColumns: boolean;
};

export function snapshotSqlIdentifiers(source: SnapshotSource): {
  readonly alias: string;
  readonly table: string;
  readonly orderPrefix: string;
} {
  const alias: string = source.alias;
  const table: string = source.table;
  assertSqlIdentifier(alias, 'snapshot alias');
  assertSqlIdentifier(table, 'snapshot table name');
  const orderPrefix = `${alias}.`;
  assertSqlPrefix(orderPrefix, 'snapshot alias prefix');
  return { alias, table, orderPrefix };
}

function pushEntityIdCondition(
  query: PatchDbQuery,
  conditions: string[],
  params: unknown[],
  columnExpr: string
): void {
  if (query.entityId === null || query.entityId === undefined) return;
  if (Array.isArray(query.entityId)) {
    if (query.entityId.length === 0) {
      conditions.push('1 = 0');
      return;
    }
    const placeholders = query.entityId.map(() => '?').join(', ');
    conditions.push(`${columnExpr} IN (${placeholders})`);
    params.push(...query.entityId);
    return;
  }
  conditions.push(`${columnExpr} = ?`);
  params.push(query.entityId);
}

export function resolveSnapshotSource(
  query: PatchDbQuery,
  options?: PgQueryBuilderOptions
): SnapshotSource {
  const partitions = options?.partitions;
  const et = query.entityType;
  if (
    partitions !== undefined &&
    et !== undefined &&
    et !== '' &&
    typeof query.entityId !== 'string' // bare entity-id queries hit the
    // view fast-path in read-ops; per-entity-table lookups don't help there.
  ) {
    const info = partitions.get(et);
    if (info !== null) {
      assertSqlIdentifier(info.tableName, 'snapshot per-entity table name');
      return { table: info.tableName, alias: 's', hasTypedColumns: true };
    }
    assertSqlIdentifier(
      UNREGISTERED_SNAPSHOT_TABLE,
      'unregistered snapshot table name'
    );
    return {
      table: UNREGISTERED_SNAPSHOT_TABLE,
      alias: 's',
      hasTypedColumns: false,
    };
  }
  return { table: 'snapshots', alias: 's', hasTypedColumns: false };
}

export function buildSnapshotConditions(
  query: PatchDbQuery,
  options?: PgQueryBuilderOptions
): {
  conditions: string[];
  params: unknown[];
  source: SnapshotSource;
} {
  const conditions: string[] = [];
  const params: unknown[] = [];
  const source = resolveSnapshotSource(query, options);
  const aliasPrefix = source.alias === '' ? '' : `${source.alias}.`;
  assertSqlPrefix(aliasPrefix, 'snapshot alias prefix');

  if (query.entityType !== null && query.entityType !== undefined) {
    conditions.push(`${aliasPrefix}entity_type = ?`);
    params.push(query.entityType);
  }

  pushEntityIdCondition(query, conditions, params, `${aliasPrefix}entity_id`);

  if (query.where) {
    const ctx = rootWhereCtx(
      `${aliasPrefix}attributes`,
      query.entityType,
      options,
      source.hasTypedColumns ? source.alias : null
    );
    const fragment = buildWhereClauseForColumn(query.where, ctx);
    conditions.push(fragment.sql);
    params.push(...fragment.params);
  }

  if (conditions.length === 0) {
    conditions.push('1=1');
  }

  return { conditions, params, source };
}

export function buildPatchConditions(
  query: PatchDbQuery,
  tableAlias = 'p',
  options?: PgQueryBuilderOptions
): { conditions: string[]; params: unknown[] } {
  assertSqlPrefix(
    `${tableAlias}.`,
    'Invalid tableAlias for patch conditions (must be a simple SQL identifier)'
  );
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (query.entityType !== null && query.entityType !== undefined) {
    conditions.push(`${tableAlias}.entity_type = ?`);
    params.push(query.entityType);
  }

  pushEntityIdCondition(query, conditions, params, `${tableAlias}.entity_id`);

  if (query.where) {
    // Patches table is not partitioned; generated columns are snapshot-only.
    const ctx = rootWhereCtx(
      `${tableAlias}.attributes`,
      query.entityType,
      options,
      null
    );
    const fragment = buildWhereClauseForColumn(query.where, ctx);
    conditions.push(fragment.sql);
    params.push(...fragment.params);
  }

  if (conditions.length === 0) {
    conditions.push('1=1');
  }

  return { conditions, params };
}

function lookupAttributeDataType(
  options: PgQueryBuilderOptions | undefined,
  entityType: PatchEntityType | undefined,
  attribute: AttributeKey
): DataType | null {
  if (options === undefined || options.schemaRegistry === undefined) {
    return null;
  }
  if (entityType === undefined || entityType === '') return null;
  const schema = options.schemaRegistry.get(entityType);
  if (schema === null) return null;
  const tag = schema.attributes.get(attribute);
  return tag?.dataType ?? null;
}

function lookupGeneratedColumnByOption(
  options: PgQueryBuilderOptions | undefined,
  entityType: PatchEntityType | undefined,
  attribute: AttributeKey
): GeneratedColumnSpec | null {
  if (options === undefined || options.partitions === undefined) return null;
  if (entityType === undefined || entityType === '') return null;
  const info = options.partitions.get(entityType);
  if (info === null) return null;
  return info.columnsByAttribute.get(patchDbAttributeKey(attribute)) ?? null;
}

function orderItemSql(args: {
  readonly attrKey: AttributeKey;
  readonly direction: 'asc' | 'desc';
  readonly attributePrefix: string;
  readonly entityType: PatchEntityType | undefined;
  readonly options: PgQueryBuilderOptions | undefined;
}): string {
  const { attrKey, direction, attributePrefix, entityType, options } = args;
  assertDirection(direction);
  const dir = direction === 'desc' ? 'DESC' : 'ASC';
  const gen = lookupGeneratedColumnByOption(options, entityType, attrKey);
  if (gen !== null) {
    assertSqlIdentifier(gen.columnName, 'order-by generated column');
    return `${attributePrefix}${gen.columnName} ${dir}`;
  }
  const path = jsonPathForAttribute(attrKey);
  const key = sqliteJsonPathToKey(path);
  const escaped = key.replace(/'/g, "''");
  const base = `(${attributePrefix}attributes::jsonb ->> '${escaped}')`;
  // Match the index expression for numeric attributes — without `::numeric`
  // here, the planner does a Sort node over a Seq Scan even though a
  // covering numeric expression-index exists.
  const dataType = lookupAttributeDataType(options, entityType, attrKey);
  const expr = isNumericIndexDataType(dataType) ? `(${base}::numeric)` : base;
  return `${expr} ${dir}`;
}

export function buildOrderSQL(
  query: PatchDbQuery,
  defaultOrder: string,
  attributePrefix = '',
  options?: PgQueryBuilderOptions
): string {
  assertSqlPrefix(
    attributePrefix,
    'Invalid attributePrefix for ORDER BY (must be empty or "<identifier>.")'
  );
  if (query.orderBy && query.orderBy.length > 0) {
    const custom = query.orderBy
      .map((o) =>
        orderItemSql({
          attrKey: patchDbAttributeKey(o.attribute),
          direction: o.direction,
          attributePrefix,
          entityType: query.entityType,
          options,
        })
      )
      .join(', ');
    const tiebreaker = defaultOrder.replace(/^ORDER BY\s+/i, '');
    const orderBy = `ORDER BY ${custom}, ${tiebreaker}`;
    assertOrderByFragment(orderBy);
    return orderBy;
  }
  assertOrderByFragment(defaultOrder);
  return defaultOrder;
}

export function buildLimitSQL(
  query: PatchDbQuery,
  options?: { overFetch?: boolean }
): {
  sql: string;
  params: unknown[];
} {
  let sql = '';
  const params: unknown[] = [];
  if (query.limit !== null && query.limit !== undefined) {
    assert.nonNegativeInteger(
      query.limit,
      'query.limit must be a non-negative safe integer'
    );
    const fetchLimit =
      options?.overFetch === true ? query.limit + 1 : query.limit;
    sql += ' LIMIT ?';
    params.push(fetchLimit);
  }
  if (query.offset !== null && query.offset !== undefined) {
    assert.nonNegativeInteger(
      query.offset,
      'query.offset must be a non-negative safe integer'
    );
    sql += ' OFFSET ?';
    params.push(query.offset);
  }
  assertOffsetLimitFragment(sql);
  return { sql, params };
}
