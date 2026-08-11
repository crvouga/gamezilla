/**
 * Minimal typings for Node's built-in `node:sqlite` (Node 22.5+).
 * Root catalog still pins `@types/node` to v20, which does not ship these.
 */
declare module 'node:sqlite' {
  type StatementResult = {
    readonly changes: number | bigint;
    readonly lastInsertRowid: number | bigint;
  };

  type StatementSync = {
    get(...params: unknown[]): Record<string, unknown> | undefined;
    all(...params: unknown[]): Record<string, unknown>[];
    run(...params: unknown[]): StatementResult;
  };

  class DatabaseSync {
    constructor(path: string);
    close(): void;
    exec(sql: string): void;
    prepare(sql: string): StatementSync;
  }

  export { DatabaseSync };
}
