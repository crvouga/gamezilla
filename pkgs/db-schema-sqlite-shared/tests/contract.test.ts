import { runDbSchemaContractTests } from '@pkgs/db-schema-shared/contract-suite';
import { SqlClientImplMockingbirdSqlite } from '@pkgs/sql-client-sqlite-shared/impl-mockingbird-sqlite';
import { sqlite } from '@pkgs/db-schema-sqlite-shared/driver';

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
