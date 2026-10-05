import type { RunResult } from '@pkgs/sql-client-root-shared/interface';
import type { SerializedError, SqlWire } from './rpc';

/**
 * Wire protocol between the owner tab and its dedicated SQLite worker.
 *
 * Every request carries a caller-minted `id`; the worker answers with exactly
 * one response of the same `id`. All payloads are structured-clone safe.
 */
export type SqliteWorkerOp = keyof SqliteWorkerOps;

export type SqliteWorkerOps = {
  readonly open: {
    readonly args: { readonly dbName: string };
    readonly result: SqliteWorkerOpenResult;
  };
  readonly query: {
    readonly args: SqlWire;
    readonly result: Record<string, unknown>[];
  };
  readonly run: {
    readonly args: SqlWire;
    readonly result: RunResult;
  };
  readonly exportBytes: {
    readonly args: Record<string, never>;
    readonly result: Uint8Array;
  };
  readonly importBytes: {
    readonly args: { readonly bytes: Uint8Array };
    readonly result: null;
  };
  readonly close: {
    readonly args: Record<string, never>;
    readonly result: null;
  };
  readonly resetStore: {
    readonly args: { readonly dbName: string };
    readonly result: null;
  };
};

export type SqliteWorkerOpenResult = {
  /** True when bytes live in OPFS (survive reloads); false for memory fallback. */
  readonly persistent: boolean;
  readonly vfs: string;
};

export type SqliteWorkerRequest<O extends SqliteWorkerOp = SqliteWorkerOp> = {
  readonly id: string;
  readonly op: O;
  readonly args: SqliteWorkerOps[O]['args'];
};

export type SqliteWorkerResponse<O extends SqliteWorkerOp = SqliteWorkerOp> =
  | {
      readonly id: string;
      readonly ok: true;
      readonly result: SqliteWorkerOps[O]['result'];
    }
  | {
      readonly id: string;
      readonly ok: false;
      readonly error: SerializedError;
    };

/** Minimal `MessagePort` / `Worker` shape shared by both ends. */
export type SqliteWorkerPort = {
  postMessage: (message: unknown) => void;
  onmessage: ((event: MessageEvent) => void) | null;
};

export function isSqliteWorkerRequest(
  value: unknown
): value is SqliteWorkerRequest {
  if (value === null || typeof value !== 'object') return false;
  const v = value as { id?: unknown; op?: unknown; args?: unknown };
  return (
    typeof v.id === 'string' &&
    typeof v.op === 'string' &&
    v.args !== null &&
    typeof v.args === 'object'
  );
}

export function isSqliteWorkerResponse(
  value: unknown
): value is SqliteWorkerResponse {
  if (value === null || typeof value !== 'object') return false;
  const v = value as { id?: unknown; ok?: unknown };
  return typeof v.id === 'string' && typeof v.ok === 'boolean';
}
