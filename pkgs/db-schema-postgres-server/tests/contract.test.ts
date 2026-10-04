import { runDbSchemaContractTests } from '@pkgs/db-schema-shared/contract-suite';
import type { PostgresSqlClient } from '@pkgs/sql-client-shared/interface';
import { createPostgresDbScope } from '@pkgs/sql-client-shared/postgres-db-scope';
import { SqlClientImplMockingbirdPostgres } from '@pkgs/sql-client-postgres-server/impl-mockingbird-postgres';
import { postgres } from '@pkgs/db-schema-postgres-shared/driver';

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
