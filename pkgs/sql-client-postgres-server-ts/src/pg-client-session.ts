import type { Client } from '@pkgs/sql-client-postgres-shared-ts/pg-types';

export type PgClientConnection = Omit<Client, 'connect'> & {
  readonly connect: () => Promise<unknown>;
  readonly on: (event: 'error', listener: (error: Error) => void) => unknown;
};

/** Owns the transport's lifetime alongside its query promises. */
export function createPgClientSession(connection: PgClientConnection): Client {
  let failure: Error | undefined;
  connection.on('error', (error) => {
    failure ??= error;
  });
  return {
    async connect() {
      await connection.connect();
    },
    query: (...args: Parameters<Client['query']>) => {
      if (failure !== undefined) {
        const callback = args.at(-1);
        if (typeof callback === 'function') {
          callback(failure, undefined);
          return undefined;
        }
        return Promise.reject(failure);
      }
      return Reflect.apply(connection.query, connection, args);
    },
    async end() {
      await connection.end().catch((error: unknown) => {
        throw failure ?? error;
      });
      // An idle transport failure still belongs to the owner, even when it
      // has no later query. Closing reports it through the normal boundary.
      if (failure !== undefined) throw failure;
    },
  };
}
