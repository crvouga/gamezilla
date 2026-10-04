import type { SqlClient } from '@pkgs/sql-client-root-shared/interface';
import type {
  SqliteWorkerOpenResult,
  SqliteWorkerOps,
  SqliteWorkerPort,
  SqliteWorkerRequest,
  SqliteWorkerResponse,
} from './protocol';
import { isSqliteWorkerRequest } from './protocol';
import { serializeError } from './rpc';
import { sqlFromWire } from './sql-wire';

/** A live SQLite connection the worker serves requests against. */
export type SqliteWorkerDatabase = SqlClient & {
  exportDatabaseBytes: () => Uint8Array;
  importDatabaseBytes: (bytes: Uint8Array) => void | Promise<void>;
};

export type SqliteWorkerOpenedDatabase = SqliteWorkerOpenResult & {
  readonly db: SqliteWorkerDatabase;
};

/**
 * Storage backend the worker host drives. The browser entry supplies an OPFS
 * SAH-pool backend (memory fallback); tests supply an in-memory one.
 */
export type SqliteWorkerBackend = {
  open: (dbName: string) => Promise<SqliteWorkerOpenedDatabase>;
  /** Delete durable bytes for `dbName`. Only called with no open connection. */
  wipe: (dbName: string) => Promise<void>;
};

export type SqliteWorkerHost = {
  handle: (request: SqliteWorkerRequest) => Promise<SqliteWorkerResponse>;
  /** Close any open connection (worker teardown). */
  dispose: () => Promise<void>;
};

type OpHandlers = {
  readonly [O in keyof SqliteWorkerOps]: (
    args: SqliteWorkerOps[O]['args']
  ) => Promise<SqliteWorkerOps[O]['result']>;
};

class SqliteWorkerHostImpl implements SqliteWorkerHost {
  private opened: SqliteWorkerOpenedDatabase | null = null;
  private readonly handlers: OpHandlers;

  constructor(private readonly backend: SqliteWorkerBackend) {
    this.handlers = {
      open: (args) => this.open(args.dbName),
      query: async (wire) => this.requireDb().query(sqlFromWire(wire)),
      run: async (wire) => this.requireDb().run(sqlFromWire(wire)),
      exportBytes: async () => this.requireDb().exportDatabaseBytes(),
      importBytes: async (args) => {
        await this.requireDb().importDatabaseBytes(args.bytes);
        return null;
      },
      close: async () => {
        await this.closeDb();
        return null;
      },
      resetStore: async (args) => {
        await this.closeDb();
        await this.backend.wipe(args.dbName);
        return null;
      },
    };
  }

  private requireDb(): SqliteWorkerDatabase {
    if (this.opened === null) {
      throw new Error('SQLite worker: database is not open');
    }
    return this.opened.db;
  }

  private async open(dbName: string): Promise<SqliteWorkerOpenResult> {
    await this.closeDb();
    const opened = await this.backend.open(dbName);
    this.opened = opened;
    return { persistent: opened.persistent, vfs: opened.vfs };
  }

  private async closeDb(): Promise<void> {
    const opened = this.opened;
    if (opened === null) return;
    this.opened = null;
    await opened.db.disconnect();
  }

  async handle(request: SqliteWorkerRequest): Promise<SqliteWorkerResponse> {
    try {
      const handler = this.handlers[request.op] as
        | ((args: unknown) => Promise<unknown>)
        | undefined;
      if (handler === undefined) {
        throw new Error(`SQLite worker: unknown op "${String(request.op)}"`);
      }
      const result = await handler(request.args);
      return { id: request.id, ok: true, result } as SqliteWorkerResponse;
    } catch (error: unknown) {
      return { id: request.id, ok: false, error: serializeError(error) };
    }
  }

  dispose(): Promise<void> {
    return this.closeDb();
  }
}

export function createSqliteWorkerHost(
  backend: SqliteWorkerBackend
): SqliteWorkerHost {
  return new SqliteWorkerHostImpl(backend);
}

/**
 * Serve {@link SqliteWorkerRequest}s arriving on `port`. Requests are handled
 * strictly in order so `BEGIN … COMMIT` sequences never interleave.
 */
export function attachSqliteWorkerHost(
  port: SqliteWorkerPort,
  host: SqliteWorkerHost
): () => void {
  let tail: Promise<unknown> = Promise.resolve();
  port.onmessage = (event) => {
    const data = event.data;
    if (!isSqliteWorkerRequest(data)) return;
    tail = tail.then(
      async () => {
        port.postMessage(await host.handle(data));
      },
      async () => {
        port.postMessage(await host.handle(data));
      }
    );
  };
  return () => {
    port.onmessage = null;
  };
}
