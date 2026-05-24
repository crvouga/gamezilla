/**
 * Pure SQL-fragment helpers used by the reconciler ({@link ./pg-reconcile})
 * to emit generated-column DDL. Kept in its own file so the reconciler
 * can focus on the diff/apply orchestration without owning literal-string
 * formatting.
 */
import type { GeneratedColumnSpec } from './partitioning';
import { pgColumnTypeFor } from './partitioning';

/** Postgres single-quoted string literal with embedded quotes doubled. */
export function quoteSqlString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

/**
 * Builds the generated-column expression. We always cast to the target
 * column type so a non-text source key (e.g. `1500` for `chess.puzzle/rating`)
 * is materialised as `numeric`, not `text` — that's the whole point of the
 * generated column path (typed comparisons + native btrees).
 */
export function generatedColumnExpression(spec: GeneratedColumnSpec): string {
  const colType = pgColumnTypeFor(spec.dataType);
  const escapedKey = quoteSqlString(spec.attribute);
  if (colType === 'text') {
    return `((attributes::jsonb ->> ${escapedKey}))`;
  }
  return `((attributes::jsonb ->> ${escapedKey})::${colType})`;
}
