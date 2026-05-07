import { createAdapterFactory } from '@better-auth/core/db/adapter';
import type { SqlClient } from '@gamezilla/lib/sql-client/interface';

import { createBetterAuthSqlDbOps } from './sql-client-better-auth-db-ops';

export function createSqlClientBetterAuthAdapter(sql: SqlClient) {
  return createAdapterFactory({
    config: {
      adapterId: 'sql-client',
      adapterName: 'SqlClient (PostgreSQL)',
      transaction: false,
      supportsUUIDs: true,
      supportsJSON: true,
      supportsBooleans: true,
      supportsDates: true,
    },
    adapter: ({ getFieldName }) => createBetterAuthSqlDbOps(sql, getFieldName),
  });
}
