/**
 * Numeric data-type classification used by partition gen-col selection and
 * the query builder's ORDER-BY cast. Lives as a tiny leaf so the indexes/
 * Phase-1 directory can be deleted without orphaning this one helper.
 *
 * Data types listed here are the ones for which both the generated column
 * (in {@link ./partitioning} `pgColumnTypeFor`) and the JSONB-extract cast
 * (in {@link ./query-builder-pg-snapshot} `orderItemSql`) materialise as
 * `numeric` so comparisons stay magnitude-ordered.
 */
import type { DataType } from '@pkgs/attribute';

const NUMERIC_DATA_TYPES: ReadonlySet<DataType> = new Set<DataType>([
  'integer',
  'number',
  'bigint',
]);

export function isNumericIndexDataType(dataType: DataType | null): boolean {
  return dataType !== null && NUMERIC_DATA_TYPES.has(dataType);
}
