/**
 * Matrix contract suite: same behavioural tests on Bun SQLite and
 * PGlite Postgres (with {@link installPostgresSqliteCompat}).
 */

import { afterAll, describe } from 'bun:test';
import { Database } from 'bun:sqlite';
import { PGlite } from '@electric-sql/pglite';
import { createPgliteSqlClient } from '@pkgs/sql-client/postgres/impl-pglite';
import { SqlClientImplBunSqlite } from '@pkgs/sql-client/sqlite/impl-bun-sqlite';
import { MatchmakingImplSql } from './impl-sql';
import {
  type BootOverrides,
  resolveConfig,
  runMatchmakingAppContractTests,
  runMatchmakingContractTests,
} from './testing';

type Backend = {
  readonly name: string;
  readonly dialect: 'sqlite' | 'postgres';
  readonly openClient: () => Promise<{
    readonly sqlClient: import('@pkgs/sql-client/interface').SqlClient;
    readonly close: () => Promise<void>;
  }>;
};

const backends: readonly Backend[] = [
  {
    name: 'sqlite',
    dialect: 'sqlite',
    openClient: async () => {
      const db = new Database(':memory:');
      const sqlClient = new SqlClientImplBunSqlite(db);
      return {
        sqlClient,
        close: async () => {
          db.close(false);
        },
      };
    },
  },
  {
    name: 'postgres',
    dialect: 'postgres',
    openClient: async () => {
      const db = await PGlite.create();
      const sqlClient = createPgliteSqlClient(db);
      return {
        sqlClient,
        close: async () => {
          await db.close();
        },
      };
    },
  },
];

for (const backend of backends) {
  const closers: Array<() => Promise<void>> = [];

  async function factory(overrides?: BootOverrides) {
    const opened = await backend.openClient();
    closers.push(opened.close);
    const config = resolveConfig(overrides);
    const mm = new MatchmakingImplSql({
      ...config,
      sqlClient: opened.sqlClient,
      dialect: backend.dialect,
    });
    await mm.ready();
    return mm;
  }

  describe(`MatchmakingImplSql (${backend.name}) contract`, () => {
    afterAll(async () => {
      for (const close of closers.splice(0)) {
        await close();
      }
    });
    runMatchmakingContractTests(factory);
  });

  describe(`MatchmakingImplSql (${backend.name}) app contract`, () => {
    afterAll(async () => {
      for (const close of closers.splice(0)) {
        await close();
      }
    });
    runMatchmakingAppContractTests(factory);
  });
}
