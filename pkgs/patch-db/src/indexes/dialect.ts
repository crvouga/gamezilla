/**
 * Engine-specific compiler interface for declarative snapshot indexes. Each
 * patch-db engine (Postgres, SQLite) ships an `IndexDialect` that knows how to
 * read existing index names from its catalog and how to compile a normalized
 * spec into native `CREATE INDEX` / `DROP INDEX` DDL.
 */
import type { SqlClient } from '@gamezilla/sql-client/interface';
import type { NormalizedIndexSpec } from './index-spec';

export type IndexDialect = {
  /** Returns the names of indexes whose name starts with `ownedNamePrefix` and
   * which target the patch-db `snapshots` table. The reconciler treats every
   * other index as out-of-scope and never touches it. */
  introspect(args: {
    sqlClient: SqlClient;
    ownedNamePrefix: string;
  }): Promise<readonly string[]>;
  /** SQL to create the index. Should be idempotent (`IF NOT EXISTS`). */
  ddlCreate(spec: NormalizedIndexSpec): string;
  /** SQL to drop an index by name. Should be idempotent (`IF EXISTS`). */
  ddlDrop(indexName: string): string;
};
