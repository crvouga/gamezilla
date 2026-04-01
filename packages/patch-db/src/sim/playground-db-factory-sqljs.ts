import { SqlClientImplSqlJs } from '@gamezilla/shared/sql-client/impl-sql-js';
import type { PlaygroundDbFactory } from './playground-sim';

/**
 * In-memory sql.js-backed factory for tests running in Bun/Node.
 * Each "database" is an ephemeral in-memory SQLite instance.
 */
export function sqlJsPlaygroundDbFactory(): PlaygroundDbFactory {
  return {
    create: (_label) => SqlClientImplSqlJs.openMemory(),
    reopen: (_label) => SqlClientImplSqlJs.openMemory(),
    remove: async () => {},
    removeAll: async () => {},
  };
}
