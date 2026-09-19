import type { Schema } from './types';
import { PRODUCT_COLUMN_TYPE_SET } from './types';

/**
 * Enforce the product-schema profile on `appSchema`: the six portable tokens,
 * no engine-specific physical overrides, and portable tombstone types. The
 * local SQLite cache and the Postgres authority must agree on every column
 * shape, so a product table may not lean on a dialect-only type. Infra
 * schemas keep the full token set.
 */
export function assertProductSchema(schema: Schema): void {
  const declared = schema._declared;
  const violations: string[] = [];
  for (const [table, columns] of Object.entries(declared.tables)) {
    for (const [column, col] of Object.entries(columns)) {
      const path = `${table}.${column}`;
      if (!PRODUCT_COLUMN_TYPE_SET.has(col.type)) {
        violations.push(
          `${path}: type '${col.type}' is not a product token (${[...PRODUCT_COLUMN_TYPE_SET].join('|')})`
        );
      }
      if (col.physicalSqlite !== undefined) {
        violations.push(
          `${path}: sqlite physical override '${col.physicalSqlite}' is not allowed in appSchema`
        );
      }
      if (col.physicalPostgres !== undefined) {
        violations.push(
          `${path}: postgres physical override '${col.physicalPostgres}' is not allowed in appSchema`
        );
      }
    }
  }
  for (const [key, entry] of declared.retiredColumns) {
    if (!PRODUCT_COLUMN_TYPE_SET.has(entry.type)) {
      violations.push(
        `${key}: retired type '${entry.type}' is not a product token`
      );
    }
  }
  if (violations.length > 0) {
    throw new Error(
      `appSchema violates the product schema profile:\n${violations.join('\n')}`
    );
  }
}
