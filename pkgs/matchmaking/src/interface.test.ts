/**
 * Matrix contract suite: same behavioural tests on Bun SQLite and
 * PGlite Postgres. Compat install is automatic (no-op on SQLite).
 */

import { Database } from 'bun:sqlite';
import { afterAll, describe } from 'bun:test';
import { PGlite } from '@electric-sql/pglite';
import { SqlClientImplAgnostic } from '@pkgs/sql-client/impl-agnostic';
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
  readonly openClient: () => Promise<{
    readonly sqlClient: import('@pkgs/sql-client/interface').SqlClient;
    readonly close: () => Promise<void>;
  }>;
};

const backends: readonly Backend[] = [
  {
    name: 'sqlite',
    openClient: async () => {
      const db = new Database(':memory:');
      const sqlClient = new SqlClientImplAgnostic(
        new SqlClientImplBunSqlite(db)
      );
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
    openClient: async () => {
      const db = await PGlite.create();
      const sqlClient = new SqlClientImplAgnostic(createPgliteSqlClient(db));
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
