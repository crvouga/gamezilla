import { expect, test } from 'bun:test';
import type {
  SqliteWorkerPort,
  SqliteWorkerResponse,
} from '@pkgs/sql-client-sqlite-web-shared-ts/protocol';
import { attachInitializingSqliteWorkerHost } from '@pkgs/sql-client-sqlite-web-shared-ts/sqlite-worker-startup';

// regression: sqlite-worker-initialization-rejection-hides-cause
test('an early open receives the WASM initialization error instead of timing out', async () => {
  const responses: SqliteWorkerResponse[] = [];
  let answered!: () => void;
  const response = new Promise<void>((resolve) => {
    answered = resolve;
  });
  const port: SqliteWorkerPort = {
    onmessage: null,
    postMessage: (message) => {
      responses.push(message as SqliteWorkerResponse);
      answered();
    },
  };
  const error = new TypeError('Failed to fetch sqlite3.wasm');
  attachInitializingSqliteWorkerHost(port, async () => {
    throw error;
  });
  port.onmessage?.({
    data: { id: 'open_1', op: 'open', args: { dbName: 'user_a' } },
  } as MessageEvent);
  await response;
  expect(responses).toEqual([
    {
      id: 'open_1',
      ok: false,
      error: expect.objectContaining({
        name: 'TypeError',
        message: 'Failed to fetch sqlite3.wasm',
      }),
    },
  ]);
});
