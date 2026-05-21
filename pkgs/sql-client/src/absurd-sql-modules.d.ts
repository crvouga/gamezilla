declare module '@jlongster/sql.js' {
  const initSqlJs: (...args: unknown[]) => Promise<unknown>;
  export default initSqlJs;
}

declare module '@jlongster/sql.js/dist/worker.sql-wasm.js' {
  const initSqlJs: (...args: unknown[]) => Promise<unknown>;
  export default initSqlJs;
}

declare module 'absurd-sql' {
  export class SQLiteFS {
    constructor(FS: unknown, backend: unknown);
  }
}

declare module 'absurd-sql/dist/indexeddb-backend' {
  const IndexedDBBackend: new () => unknown;
  export default IndexedDBBackend;
}

declare module 'absurd-sql/dist/indexeddb-main-thread' {
  export function initBackend(worker: Worker): void;
}
