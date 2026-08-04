/**
 * Re-exported `node-postgres` types so application code can reference a
 * `Client` / `Pool` without importing `pg` directly. Direct `pg` imports are
 * banned outside this package (`tools/scripts/check-no-direct-pg-imports.ts`); types
 * are erased at runtime but the import specifier still trips the guard, so
 * route type-only needs through here.
 */
export type {
  Client,
  ClientBase,
  Pool,
  PoolClient,
  QueryResult,
  QueryResultRow,
} from 'pg';
