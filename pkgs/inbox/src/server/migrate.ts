import type { SqlClient } from '@pkgs/sql-client/interface';

import {
  CREATE_INTERACTIONS_LIST_INDEX_SQL,
  CREATE_INTERACTIONS_SOURCE_INDEX_SQL,
  CREATE_INTERACTIONS_TABLE_SQL,
  CREATE_PREFERENCES_TABLE_SQL,
  CREATE_SCHEMA_STATE_TABLE_SQL,
  INBOX_SCHEMA_FINGERPRINT,
  READ_SCHEMA_FINGERPRINT_SQL,
  UPSERT_SCHEMA_FINGERPRINT_SQL,
} from './migrate-sql';

const BOOT_STATEMENTS = [
  CREATE_SCHEMA_STATE_TABLE_SQL,
  CREATE_INTERACTIONS_TABLE_SQL,
  CREATE_INTERACTIONS_SOURCE_INDEX_SQL,
  CREATE_INTERACTIONS_LIST_INDEX_SQL,
  CREATE_PREFERENCES_TABLE_SQL,
] as const;

export async function migrateInbox(sql: SqlClient): Promise<void> {
  for (const statement of BOOT_STATEMENTS) {
    await sql.run(statement);
  }

  const rows = await sql.query<{ schema_fingerprint: string }>(
    READ_SCHEMA_FINGERPRINT_SQL
  );
  const current = rows[0]?.schema_fingerprint;
  if (current === INBOX_SCHEMA_FINGERPRINT) return;

  await sql.run(UPSERT_SCHEMA_FINGERPRINT_SQL, [INBOX_SCHEMA_FINGERPRINT]);
}

export { INBOX_SCHEMA_FINGERPRINT };
