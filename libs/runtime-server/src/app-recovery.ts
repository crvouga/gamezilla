import { RecoverAccountData } from '@libs/account-privacy-server/recover-account-data';
import type { Clock } from '@pkgs/clock-shared/types';
import { readUtf8, writeUtf8 } from '@pkgs/object-store-shared/helpers';
import type { ObjectStore } from '@pkgs/object-store-shared/interface';
import type { RoomServicePort } from '@pkgs/room-shared/room-service';
import sql, { ident, join } from '@pkgs/sql-shared/sql';
import type { Value } from '@pkgs/sql-shared/sql';
import type { SqlClient, SqlTx } from '@pkgs/sql-client-shared/interface';
import type { CreateId } from '@pkgs/uuid-shared/create-id';
import { APP } from '@libs/runtime-shared/app-features';

type RecoveryCopy = Readonly<Record<string, readonly Record<string, Value>[]>>;
// Privacy journals and disclosed exceptions are authoritative live records.
const JOURNALS = new Set([
  'profile_account_privacy',
  'profile_deletion_receipts',
  'profile_legal_preservations',
  'billing_payment_evidence',
  'billing_account_closures',
]);
export class AppRecovery {
  constructor(
    private readonly db: SqlClient,
    private readonly ports: {
      readonly rooms: RoomServicePort;
      readonly clock: Clock;
      readonly createId: CreateId;
      readonly objectStore: ObjectStore;
    }
  ) {}
  async save(key: string): Promise<void> {
    const copy: Record<string, readonly Record<string, Value>[]> = {};
    for (const table of APP.tableNames) {
      if (!JOURNALS.has(table))
        copy[table] = await this.db.query(
          sql<Record<string, Value>>`SELECT * FROM ${ident(table)}`
        );
    }
    await writeUtf8(
      this.ports.objectStore,
      `recovery/${key}.json`,
      JSON.stringify(copy),
      'application/json'
    );
  }
  async recover(key: string): Promise<void> {
    const text = await readUtf8(this.ports.objectStore, `recovery/${key}.json`);
    if (text === null) throw new Error('Recovery copy is unavailable');
    const copy = JSON.parse(text) as RecoveryCopy;
    const protection = new RecoverAccountData(this.db, {
      ...this.ports,
      contributions: APP.accountPrivacy,
    });
    await protection.execute(async (tx) => {
      for (const table of APP.tableNames) {
        if (JOURNALS.has(table)) continue;
        for (const row of copy[table] ?? []) await restoreRow(tx, table, row);
      }
    });
  }
}
async function restoreRow(
  tx: SqlTx,
  table: string,
  row: Record<string, Value>
): Promise<void> {
  const columns = Object.keys(row);
  if (!columns.includes('id')) throw new Error('Recovery row has no identity');
  const updates = columns
    .filter((column) => column !== 'id')
    .map((column) => sql`${ident(column)} = excluded.${ident(column)}`);
  await tx.run(
    sql`INSERT INTO ${ident(table)} (${join(columns.map(ident))}) VALUES (${join(columns.map((column) => row[column]))}) ON CONFLICT (id) DO UPDATE SET ${join(updates)}`
  );
}
