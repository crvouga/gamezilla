import { raw } from '@pkgs/sql';
import type { SqlTx } from '@pkgs/sql-client/interface';

import {
  CREATE_NOTIFICATIONS_LIST_INDEX_SQL,
  CREATE_NOTIFICATIONS_SOURCE_INDEX_SQL,
  CREATE_NOTIFICATIONS_TABLE_SQL,
  CREATE_SCHEMA_STATE_TABLE_SQL,
  DROP_NOTIFICATIONS_CREATED_AT_DEFAULT_SQL,
  DROP_NOTIFICATIONS_UPDATED_AT_DEFAULT_SQL,
  NOTIFICATIONS_SCHEMA_FINGERPRINT,
  READ_SCHEMA_FINGERPRINT_SQL,
  upsertSchemaFingerprintSql,
} from './migrate-sql';

const BOOT_STATEMENTS = [
  CREATE_SCHEMA_STATE_TABLE_SQL,
  CREATE_NOTIFICATIONS_TABLE_SQL,
  CREATE_NOTIFICATIONS_SOURCE_INDEX_SQL,
  CREATE_NOTIFICATIONS_LIST_INDEX_SQL,
] as const;

const DROP_WALL_DEFAULT_STATEMENTS = [
  DROP_NOTIFICATIONS_CREATED_AT_DEFAULT_SQL,
  DROP_NOTIFICATIONS_UPDATED_AT_DEFAULT_SQL,
] as const;

export async function migrateNotifications(db: SqlTx): Promise<void> {
  for (const statement of BOOT_STATEMENTS) {
    await db.run(raw(statement));
  }
  for (const statement of DROP_WALL_DEFAULT_STATEMENTS) {
    try {
      await db.run(raw(statement));
    } catch {
      // SQLite / fresh portable installs have no DEFAULT to drop.
    }
  }

  const rows = await db.query(
    raw<{ schema_fingerprint: string }>(READ_SCHEMA_FINGERPRINT_SQL)
  );
  const current = rows[0]?.schema_fingerprint;
  if (current === NOTIFICATIONS_SCHEMA_FINGERPRINT) return;

  await db.run(upsertSchemaFingerprintSql(NOTIFICATIONS_SCHEMA_FINGERPRINT));
}

export { NOTIFICATIONS_SCHEMA_FINGERPRINT };
