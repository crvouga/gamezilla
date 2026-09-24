import { runDbSchemaContractTests } from '@pkgs/db-schema/test/contract-suite';
import type { PostgresSqlClient } from '@pkgs/sql-client/interface';
import { createPostgresDbScope } from '@pkgs/sql-client/postgres-db-scope';
import { SqlClientImplPostgresMem } from '@pkgs/sql-client-postgres/impl-postgres-mem';
import { postgres } from '../src/driver';

runDbSchemaContractTests({
  name: 'postgres-mem',
  dialect: 'postgres',
  async open() {
    const client = SqlClientImplPostgresMem.open({
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
