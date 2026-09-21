/**
 * The provider's state: one SQLite database the caller opens. Every change is
 * one transaction, and transactions are serialized — one connection, many
 * concurrent requests.
 */
import type { Logger } from '@pkgs/logger';
import { createNoopLogger } from '@pkgs/logger';
import type { SqlClient } from '@pkgs/sql-client/interface';

import { ProviderDb } from './provider-db';
import { BillingMockSqliteDatabaseMigration } from './schema/sqlite-database-migration';

export type { EventDelivery, PendingEvent, StoredObject } from './provider-db';
export { ProviderDb } from './provider-db';

export class ProviderStore {
  private tail: Promise<unknown> = Promise.resolve();

  private constructor(private readonly sqlClient: SqlClient) {}

  static async open(deps: {
    readonly sqlClient: SqlClient;
    readonly logger?: Logger;
  }): Promise<ProviderStore> {
    await new BillingMockSqliteDatabaseMigration().migrate({
      sqlClient: deps.sqlClient,
      logger: deps.logger ?? createNoopLogger(),
    });
    return new ProviderStore(deps.sqlClient);
  }

  /** Runs `fn` in its own transaction, after every earlier one settles. */
  async tx<T>(fn: (db: ProviderDb) => Promise<T>): Promise<T> {
    const run = async (): Promise<T> =>
      await this.sqlClient.transaction(async (tx) => fn(new ProviderDb(tx)));
    const queued = this.tail.then(run, run);
    this.tail = queued.then(
      () => undefined,
      () => undefined
    );
    return await queued;
  }
}
