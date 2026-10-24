import { EventEmitter } from 'node:events';
import { createPgClientSession } from '@pkgs/sql-client-postgres-server-ts/pg-client-session';

export function openConnection() {
  const events = new EventEmitter();
  let queries = 0;
  let ended = false;
  const connection = {
    on: (event: 'error', listener: (error: Error) => void) =>
      events.on(event, listener),
    connect: async () => undefined,
    query: (
      _text: string,
      callback?: (error: unknown, result: unknown) => void
    ) => {
      queries += 1;
      const result = { rows: [{ value: 1 }], rowCount: 1 };
      if (callback === undefined) return Promise.resolve(result);
      queueMicrotask(() => callback(undefined, result));
      return undefined;
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
