// @io-wall-ok — tools composition root.

/**
 * A SQLite file as a simulated vendor's storage (the `sqlite` option every
 * `@crvouga/mockingbird-service-*` runtime takes), so a stack started with
 * kept data finds its vendors as it left them.
 */

import { Database } from 'bun:sqlite';

import type { StripeServerOptions } from '@crvouga/mockingbird-service-stripe/server';

export type MockingbirdSqlite = NonNullable<StripeServerOptions['sqlite']>;

export function mockingbirdSqliteFile(path: string): MockingbirdSqlite {
  const db = new Database(path, { create: true });
  return {
    exec: (source) => {
      db.exec(source);
    },
    prepare: (source) => {
      const statement = db.prepare(source);
      return {
        run: (...params) => statement.run(...params),
        all: <T>(...params: Parameters<typeof statement.all>) =>
          statement.all(...params) as T[],
        get: <T>(...params: Parameters<typeof statement.get>) =>
          (statement.get(...params) ?? undefined) as T | undefined,
      } as ReturnType<MockingbirdSqlite['prepare']>;
    },
    transaction: (fn) => db.transaction(fn)(),
  };
}
