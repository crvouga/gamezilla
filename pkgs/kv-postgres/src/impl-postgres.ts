/**
 * SQL-backed {@link Kv}. Schema via defineTable (`kvSchema`); not product appSchema.
 */

import { hotAssert } from '@pkgs/assert';
import type { Keyword } from '@pkgs/keyword/keyword';
import { assertNamespacedKeyword } from '@pkgs/keyword/keyword';
import {
  assertKvRecord,
  parseKvRecordFromUnknown,
} from '@pkgs/kv/assert-kv-record';
import type { Kv, KvRecord } from '@pkgs/kv/interface';
import type { Logger } from '@pkgs/logger/logger';
import { sql } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { createPostgresDbScope } from '@pkgs/sql-client/postgres-db-scope';
import { KvImplPostgresTx } from './impl-postgres-tx';
import { KvPostgresDatabaseMigration } from './postgres-database-migration';

/**
 * Postgres-backed {@link Kv}.
 *
 * - **`new KvImplPostgres(sqlClient, now)`** — hot paths after migrate.
 * - **`KvImplPostgres.open(...)`** — migrate then construct.
 */
export class KvImplPostgres implements Kv {
  constructor(
    private readonly sqlClient: SqlClient,
    private readonly now: () => number
  ) {}

  static async open(args: {
    sqlClient: SqlClient;
    logger: Logger;
    now: () => number;
  }): Promise<KvImplPostgres> {
    await KvImplPostgres.migrateUp(args);
    return new KvImplPostgres(args.sqlClient, args.now);
  }

  static async migrateUp(args: {
    sqlClient: SqlClient;
    logger: Logger;
  }): Promise<void> {
    await new KvPostgresDatabaseMigration({
      dbScope: createPostgresDbScope('public'),
      skipAdvisoryLock: true,
      alreadyInTransaction: false,
    }).migrate({
      sqlClient: args.sqlClient,
      logger: args.logger,
    });
  }

  async get(key: Keyword): Promise<KvRecord | null> {
    assertKvKey(key);
    const rows = await this.sqlClient.query(
      sql<{ value: unknown }>`
        SELECT value FROM kv
        WHERE key = ${key} AND deleted_at IS NULL`
    );
    const first = rows[0];
    if (first === null || first === undefined) return null;
    return parseKvRecordFromUnknown(
      hotAssert(),
      first.value,
      'kv postgres get'
    );
  }

  async put(key: Keyword, value: KvRecord): Promise<void> {
    assertKvKey(key);
    assertKvRecord(hotAssert(), value, 'kv postgres put');
    const iso = new Date(this.now()).toISOString();
    const payload = JSON.stringify(value);
    // Avoid ON CONFLICT … DO UPDATE — mockingbird-postgres mishandles excluded.* on
    // second upsert. UPDATE-then-INSERT matches soft-delete resurrect semantics.
    const updated = await this.sqlClient.run(
      sql<void>`
        UPDATE kv
        SET value = ${payload}, updated_at = ${iso}, deleted_at = NULL
        WHERE key = ${key}`
    );
    if (updated.changes > 0) return;
    await this.sqlClient.run(
      sql<void>`
        INSERT INTO kv (id, key, value, created_at, updated_at, deleted_at)
        VALUES (${key}, ${key}, ${payload}, ${iso}, ${iso}, ${null})`
    );
  }

  async zap(key: Keyword): Promise<void> {
    assertKvKey(key);
    const iso = new Date(this.now()).toISOString();
    await this.sqlClient.run(
      sql<void>`
        UPDATE kv
        SET deleted_at = ${iso}, updated_at = ${iso}
        WHERE key = ${key} AND deleted_at IS NULL`
    );
  }

  async tx<T>(fn: (tx: Kv) => Promise<T>): Promise<T> {
    return this.sqlClient.transaction(async (sqlTx) => {
      const adapter = new KvImplPostgresTx(sqlTx, this.now);
      return fn(adapter);
    });
  }
}

function assertKvKey(key: string): asserts key is Keyword {
  assertNamespacedKeyword(hotAssert(), key);
}
