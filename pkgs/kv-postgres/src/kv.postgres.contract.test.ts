/**
 * Dual-backend contract: same {@link runKvContractTests} against postgres-mem
 * via {@link KvImplPostgres}.
 */
import { afterAll, beforeAll, describe } from 'bun:test';
import { runKvContractTests } from '@pkgs/kv/kv-contract';
import { createLogger } from '@pkgs/logger';
import { raw } from '@pkgs/sql';
import { SqlClientImplPostgresMem } from '@pkgs/sql-client-postgres/impl-postgres-mem';
import { KvImplPostgres } from './impl-postgres';

describe('KvImplPostgres (postgres-mem contract)', () => {
  let sqlClient: SqlClientImplPostgresMem;
  let kv: KvImplPostgres;

  beforeAll(async () => {
    sqlClient = SqlClientImplPostgresMem.open({ seed: 1 });
    await sqlClient.connect();
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
    await sqlClient.disconnect();
  });

  runKvContractTests(async () => {
    await sqlClient.run(raw('TRUNCATE kv'));
    return kv;
  });
});
