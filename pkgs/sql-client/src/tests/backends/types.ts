import type { SqlClient } from '../../interface';

export type SqlDialect = 'sqlite' | 'postgres';

export type BackendKind =
  | 'sqlite-mem'
  | 'bun-sqlite'
  | 'sqlite-wasm'
  | 'postgres-mem'
  | 'pglite'
  | 'pg-pool'
  | 'pg-client'
  | 'bun-postgres';


export type MatrixBackend = {
  readonly kind: BackendKind;
  readonly name: string;
  readonly dialect: SqlDialect;
  readonly client: SqlClient;
  /**
   * Drop generated tables after a sample. Shared engines (PGlite) must not
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
