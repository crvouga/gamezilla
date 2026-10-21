import { runDbSchemaContractTests } from '@pkgs/db-schema-root-shared-ts/contract-suite';
import { sqlite } from '@pkgs/db-schema-sqlite-shared-ts/driver';
import { SqlClientImplMockingbirdSqlite } from '@pkgs/sql-client-sqlite-root-shared-ts/impl-mockingbird-sqlite';

runDbSchemaContractTests({
  name: 'mockingbird-sqlite',
  dialect: 'sqlite',
  async open() {
    const client = SqlClientImplMockingbirdSqlite.open();
    await client.connect();
    return {
      client,
      reconcile: (schema) => sqlite(schema, client).reconcile(),
      close: () => client.disconnect(),
    };
  },
});
