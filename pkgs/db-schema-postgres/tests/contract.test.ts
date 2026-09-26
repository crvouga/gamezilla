import { runDbSchemaContractTests } from '@pkgs/db-schema/test/contract-suite';
import type { PostgresSqlClient } from '@pkgs/sql-client/interface';
import { createPostgresDbScope } from '@pkgs/sql-client/postgres-db-scope';
import { SqlClientImplMockingbirdPostgres } from '@pkgs/sql-client-postgres/impl-mockingbird-postgres';
import { postgres } from '../src/driver';

runDbSchemaContractTests({
  name: 'mockingbird-postgres',
  dialect: 'postgres',
  async open() {
    const client = SqlClientImplMockingbirdPostgres.open({
      dbScope: createPostgresDbScope('contract'),
      seed: 1,
    });
    await client.connect();
    return {
      client,
      reconcile: (schema) =>
        postgres(schema, client as PostgresSqlClient, {
          skipAdvisoryLock: true,
        }).reconcile(),
      close: () => client.disconnect(),
    };
  },
});
