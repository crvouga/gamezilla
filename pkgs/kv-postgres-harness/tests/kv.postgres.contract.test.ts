/**
 * Dual-backend contract: same {@link runKvContractTests} against mockingbird-postgres
 * via {@link KvImplPostgres}.
 */
import { afterAll, beforeAll, describe } from 'bun:test';
import { KvImplPostgres } from '@pkgs/kv-postgres-shared/impl-postgres';
import { runKvContractTests } from '@pkgs/kv-root-shared/kv-contract';
import { createLogger } from '@pkgs/logger-shared/logger';
import { SqlClientImplMockingbirdPostgres } from '@pkgs/sql-client-postgres-server/impl-mockingbird-postgres';
import { raw } from '@pkgs/sql-root-shared/sql';

describe('KvImplPostgres (mockingbird-postgres contract)', () => {
  let sqlClient: SqlClientImplMockingbirdPostgres;
  let kv: KvImplPostgres;

  beforeAll(async () => {
    sqlClient = SqlClientImplMockingbirdPostgres.open({ seed: 1 });
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
