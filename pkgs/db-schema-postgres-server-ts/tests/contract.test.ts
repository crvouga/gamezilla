import { postgres } from '@pkgs/db-schema-postgres-shared-ts/driver';
import { runDbSchemaContractTests } from '@pkgs/db-schema-root-shared-ts/contract-suite';
import { SqlClientImplMockingbirdPostgres } from '@pkgs/sql-client-postgres-server-ts/impl-mockingbird-postgres';
import type { PostgresSqlClient } from '@pkgs/sql-client-root-shared-ts/interface';
import { createPostgresDbScope } from '@pkgs/sql-client-root-shared-ts/postgres-db-scope';

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
