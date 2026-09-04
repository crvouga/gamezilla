import type { Sql, Value } from '@pkgs/sql';
import type {
  PreparedStatement,
  RunResult,
  SqlClient,
} from '@pkgs/sql-client/interface';
import { clearExpoSqliteWebOpfsBestEffort } from '@pkgs/sql-client-sqlite/clear-expo-sqlite-web-opfs';
import type { SqlOwner } from '../sql-owner';

export const DEFAULT_SQL_HOST_URL = '/sql-workers/sql-host.html';

type SqlHostApi = {
  open: (dbName: string) => Promise<void>;
  close: () => Promise<void>;
  query: (
    sql: string,
    values?: readonly unknown[]
  ) => Promise<Record<string, unknown>[]>;
  run: (
    sql: string,
    values?: readonly unknown[]
  ) => Promise<{ lastInsertRowId: number; changes: number }>;
  resetStore: () => Promise<void>;
};

type HostWindow = Window & { __sqlHost?: SqlHostApi };

function createIframeSqlClient(host: SqlHostApi): SqlClient {
  const client: SqlClient = {
    connect: () => Promise.resolve(),
    disconnect: () => host.close(),
    query: <T extends Record<string, unknown>>(query: Sql<T>) =>
      host.query(query.sql, query.values) as Promise<T[]>,
    run: async (query: Sql<unknown>): Promise<RunResult> => {
      const result = await host.run(query.sql, query.values);
      return {
        changes: result.changes,
        lastInsertRowid: result.lastInsertRowId,
      };
    },
    prepare: <T extends Record<string, unknown>>(
      query: Sql<T>
    ): PreparedStatement<T> => ({
      query: (params?: Value[]) =>
        host.query(query.sql, params ?? query.values) as Promise<T[]>,
      run: async (params?: Value[]) => {
        const result = await host.run(query.sql, params ?? query.values);
        return {
          changes: result.changes,
          lastInsertRowid: result.lastInsertRowId,
        };
      },
    }),
    transaction: async <T>(fn: (tx: SqlClient) => Promise<T>) => {
      await host.run('BEGIN');
      try {
        const result = await fn(client);
        await host.run('COMMIT');
        return result;
      } catch (error: unknown) {
        try {
          await host.run('ROLLBACK');
        } catch {
          // preserve original
        }
        throw error;
      }
    },
  };
  return client;
}

/**
 * Product web {@link SqlOwner}: expo-sqlite lives only inside a disposable
 * iframe. Destroying the iframe releases AccessHandlePoolVFS handles so
 * in-process OPFS wipe can succeed without navigating the product Window.
 *
 * Important: expo-sqlite keeps a module-level Worker singleton inside the
 * iframe document. Terminating that Worker without remounting leaves a dead
 * reference and the next open hangs — so wipe always destroys the iframe and
 * clears OPFS from the parent, then the next `open()` mounts a fresh host.
 */
export function createExpoIframeSqlOwner(args: {
  readonly dbName: string;
  readonly hostUrl?: string;
}): SqlOwner {
  const hostUrl = args.hostUrl ?? DEFAULT_SQL_HOST_URL;
  let iframe: HTMLIFrameElement | null = null;
  let client: SqlClient | null = null;

  async function mountHost(): Promise<SqlHostApi> {
    if (typeof document === 'undefined') {
      throw new Error('createExpoIframeSqlOwner requires a document');
    }
    destroyHost();
    const frame = document.createElement('iframe');
    frame.src = hostUrl;
    frame.title = `sql-host:${args.dbName}`;
    frame.setAttribute('aria-hidden', 'true');
    frame.style.cssText =
      'position:absolute;width:0;height:0;border:0;visibility:hidden';
    const api = await new Promise<SqlHostApi>((resolve, reject) => {
      const onMessage = (event: MessageEvent) => {
        if (event.source !== frame.contentWindow) return;
        const data = event.data as { type?: string; source?: string };
        if (data?.type === 'ready' && data.source === 'sql-host') {
          window.removeEventListener('message', onMessage);
          const win = frame.contentWindow as HostWindow | null;
          const host = win?.__sqlHost;
          if (host === undefined) {
            reject(new Error('sql-host ready without __sqlHost'));
            return;
          }
          resolve(host);
        }
      };
      window.addEventListener('message', onMessage);
      frame.addEventListener('error', () => {
        window.removeEventListener('message', onMessage);
        reject(new Error(`Failed to load sql-host iframe: ${hostUrl}`));
      });
      document.body.appendChild(frame);
    });
    iframe = frame;
    return api;
  }

  /** Drop the iframe immediately — do not await host close (can hang). */
  function destroyHost(): void {
    client = null;
    if (iframe !== null) {
      iframe.remove();
      iframe = null;
    }
  }

  return {
    open: async () => {
      const host = await mountHost();
      await host.open(args.dbName);
      client = createIframeSqlClient(host);
      return client;
    },
    close: async () => {
      destroyHost();
    },
    resetStore: async () => {
      // Kill the browsing context first so AccessHandlePoolVFS sync handles
      // release, then wipe OPFS from the parent (same origin).
      destroyHost();
      const wipe = await clearExpoSqliteWebOpfsBestEffort();
      if (!wipe.ok) {
        throw wipe.error instanceof Error
          ? wipe.error
          : new Error('Failed to wipe expo-sqlite OPFS directory');
      }
    },
  };
}
