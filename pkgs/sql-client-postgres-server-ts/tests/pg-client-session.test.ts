import { expect, test } from 'bun:test';
import { EventEmitter } from 'node:events';
import { createPgClientSession } from '@pkgs/sql-client-postgres-server-ts/pg-client-session';

function openConnection() {
  const events = new EventEmitter();
  let queries = 0;
  let ended = false;
  const connection = {
    on: (event: 'error', listener: (error: Error) => void) =>
      events.on(event, listener),
    connect: async () => undefined,
    query: async () => {
      queries += 1;
      return { rows: [{ value: 1 }], rowCount: 1 };
    },
    end: async () => {
      ended = true;
    },
  };
  return {
    session: createPgClientSession(connection),
    fail: (error: Error) => events.emit('error', error),
    queries: () => queries,
    ended: () => ended,
  };
}

// regression: postgres-idle-error-kills-api
test('a fatal pool timeout stays with its session and leaves later sessions usable', async () => {
  const failed = openConnection();
  const failure = Object.assign(
    new Error('Timed out while waiting for an open slot in the pool.'),
    { code: '58000' }
  );
  expect(() => failed.fail(failure)).not.toThrow();
  expect(() =>
    failed.fail(new Error('Connection terminated unexpectedly'))
  ).not.toThrow();
  await expect(failed.session.query('SELECT 1')).rejects.toBe(failure);
  expect(failed.queries()).toBe(0);
  await expect(failed.session.end()).rejects.toBe(failure);
  expect(failed.ended()).toBe(true);

  const healthy = openConnection();
  expect(await healthy.session.query('SELECT 1')).toEqual({
    rows: [{ value: 1 }],
    rowCount: 1,
  });
  await healthy.session.end();
  expect(healthy.ended()).toBe(true);
});

test('an idle disconnect is reported on close even without another query', async () => {
  const connection = openConnection();
  const failure = new Error('Connection terminated unexpectedly');
  expect(() => connection.fail(failure)).not.toThrow();
  await expect(connection.session.end()).rejects.toBe(failure);
  expect(connection.queries()).toBe(0);
  expect(connection.ended()).toBe(true);
});

test('a failed session reports callback queries without an unhandled rejection', async () => {
  const connection = openConnection();
  const failure = new Error('Connection terminated unexpectedly');
  connection.fail(failure);
  const reported: unknown[] = [];
  const result = connection.session.query('SELECT 1', (error: unknown) => {
    reported.push(error);
  });
  expect(result).toBeUndefined();
  expect(reported).toEqual([]);
  await Promise.resolve();
  expect(reported).toEqual([failure]);
  expect(connection.queries()).toBe(0);
  await expect(connection.session.end()).rejects.toBe(failure);
});
