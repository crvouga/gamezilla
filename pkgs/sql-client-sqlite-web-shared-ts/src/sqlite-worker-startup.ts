import type { SqliteWorkerPort } from './protocol';
import { serializeError } from './rpc';
import {
  attachSqliteWorkerHost,
  type SqliteWorkerHost,
} from './sqlite-worker-host';

/** Keep early RPCs queued, and answer them even if WASM initialization fails. */
export function attachInitializingSqliteWorkerHost(
  port: SqliteWorkerPort,
  initialize: () => Promise<SqliteWorkerHost>
): () => void {
  const ready = Promise.resolve()
    .then(initialize)
    .then(
      (host) => ({ host }),
      (error: unknown) => ({ error: serializeError(error) })
    );
  return attachSqliteWorkerHost(port, {
    handle: async (request) => {
      const result = await ready;
      return 'host' in result
        ? result.host.handle(request)
        : { id: request.id, ok: false, error: result.error };
    },
    dispose: async () => {
      const result = await ready;
      if ('host' in result) await result.host.dispose();
    },
  });
}
