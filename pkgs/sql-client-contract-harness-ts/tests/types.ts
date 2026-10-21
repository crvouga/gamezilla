import type { SqlClient } from '@pkgs/sql-client-root-shared-ts/interface';

export type SqlDialect = 'sqlite' | 'postgres';

export type BackendKind =
  | 'mockingbird-sqlite'
  | 'bun-sqlite'
  | 'sqlite-wasm'
  | 'mockingbird-postgres'
  | 'pg-pool'
  | 'pg-client'
  | 'bun-postgres';

export type MatrixBackend = {
  readonly kind: BackendKind;
  readonly name: string;
  readonly dialect: SqlDialect;
  readonly client: SqlClient;
  /**
   * Drop generated tables after a sample. Shared engines must not
   * disconnect here — only wipe sample artifacts.
   */
  cleanup(tables: readonly string[]): Promise<void>;
  /** Release the engine when the suite finishes (no-op for shared handles). */
  close(): Promise<void>;
};

export type BackendFactory = {
  readonly kind: BackendKind;
  readonly name: string;
  readonly dialect: SqlDialect;
  /** When false, skip in default matrix (optional native / WASM). */
  readonly always: boolean;
  open(): Promise<MatrixBackend>;
};
