import { getMainSqliteDbName } from '@libs/app-root-shared-ts/main-sqlite-db-name';
import { LAST_LOCAL_ACCOUNT_ID_KEY } from '@libs/auth-shared-ts/auth-storage-keys';
import { registerSokobanRecovery } from '@libs/runtime-harness-ts/sokoban-recovery.steps';
import type { LiveWorld } from './live-world';

// Serialized into the disposable actor's page. A second port joins the running
// database broker as a proxy, so the TEMP trigger belongs to the app's connection.
async function runOnOwner(dbName: string, sql: string): Promise<void> {
  const worker = new SharedWorker('/sql-workers/db-host-shared-worker.js', {
    name: 'sql-db-host-v1',
    type: 'module',
  });
  const port = worker.port;
  const request = (op: string, payload: object) =>
    new Promise<{ role?: string }>((resolve, reject) => {
      const timeout = AbortSignal.timeout(10000);
      timeout.onabort = () =>
        reject(new Error(`Database broker timed out on ${op}`));
      port.onmessage = ({ data }) => {
        if (data.id !== op) return;
        timeout.onabort = null;
        if (data.ok) resolve(data.result);
        else reject(new Error(data.error.message));
      };
      port.postMessage({ id: op, dbName, op, payload });
    });
  try {
    const connection = await request('connect', {});
    try {
      if (connection.role !== 'proxy')
        throw new Error('Alice has no active database owner');
      await request('run', { sql, values: [] });
    } finally {
      await request('disconnect', {});
    }
  } finally {
    port.close();
  }
}

registerSokobanRecovery<LiveWorld>(async (world) => {
  const view = world.hostView();
  const actor = await view.evaluate(
    `localStorage.getItem(${JSON.stringify(LAST_LOCAL_ACCOUNT_ID_KEY)})`
  );
  if (typeof actor !== 'string' || actor.length === 0)
    throw new Error('The starter puzzle has no active actor');
  const database = getMainSqliteDbName(actor);
  return {
    run: (statement) =>
      view.evaluate(
        `(${runOnOwner.toString()})(${JSON.stringify(database)}, ${JSON.stringify(statement.sql)})`
      ),
  };
});
