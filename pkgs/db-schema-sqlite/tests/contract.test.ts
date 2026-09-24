import { runDbSchemaContractTests } from '@pkgs/db-schema/test/contract-suite';
import { SqlClientImplMockingbirdSqlite } from '@pkgs/sql-client-sqlite/impl-mockingbird-sqlite';
import { sqlite } from '../src/driver';

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
