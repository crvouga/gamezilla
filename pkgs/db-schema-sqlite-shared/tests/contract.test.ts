import { runDbSchemaContractTests } from '@pkgs/db-schema-shared/contract-suite';
import { sqlite } from '@pkgs/db-schema-sqlite-shared/driver';
import { SqlClientImplMockingbirdSqlite } from '@pkgs/sql-client-sqlite-shared/impl-mockingbird-sqlite';

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
