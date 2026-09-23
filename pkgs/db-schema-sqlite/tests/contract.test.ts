import { runDbSchemaContractTests } from '@pkgs/db-schema/test/contract-suite';
import { SqlClientImplSqliteMem } from '@pkgs/sql-client-sqlite/impl-sqlite-mem';
import { sqlite } from '../src/driver';

runDbSchemaContractTests({
  name: 'sqlite-mem',
  dialect: 'sqlite',
  async open() {
    const client = SqlClientImplSqliteMem.open();
    await client.connect();
    return {
      client,
      reconcile: (schema) => sqlite(schema, client).reconcile(),
      close: () => client.disconnect(),
    };
  },
});
