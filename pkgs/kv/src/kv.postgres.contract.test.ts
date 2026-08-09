/**
 * Dual-backend contract: same {@link runKvContractTests} against PGlite
 * (Postgres dialect) via {@link KvImplPostgres}.
 */
import { afterAll, beforeAll, describe } from 'bun:test';
import { PGlite } from '@electric-sql/pglite';
import { createLogger } from '@pkgs/logger';
import { raw } from '@pkgs/sql';
import { createPgliteSqlClient } from '@pkgs/sql-client/postgres/impl-pglite';

import { KvImplPostgres } from './impl-postgres';
import { runKvContractTests } from './kv-contract';

describe('KvImplPostgres (PGlite contract)', () => {
  let db: PGlite;
  let kv: KvImplPostgres;

  beforeAll(async () => {
    db = await PGlite.create();
    const sqlClient = createPgliteSqlClient(db);
    const now = () => 1_700_000_000_000;
    kv = await KvImplPostgres.open({
      sqlClient,
      logger: createLogger({
        name: 'kv-postgres-contract',
        now,
        level: 'silent',
      }),
      now,
    });
  });

  afterAll(async () => {
    await db.close();
  });

  runKvContractTests(async () => {
    await createPgliteSqlClient(db).run(raw('TRUNCATE kv'));
    return kv;
  });
});
