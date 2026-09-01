import { defineTable, registerTables } from '@pkgs/db-schema';
import { applySqliteSchema } from '@pkgs/db-schema/sqlite';
import { raw, sql } from '@pkgs/sql';
import type { SqlClient } from '../interface';
import type { SqlClientWebState } from './types';

/** `user_version = epoch * STRIDE + migrationIndex`, same shape as product. */
export const VERSION_STRIDE = 1_000;

const toyKvTable = defineTable({
  domain: 'toy_kv',
  name: 'toy_kv',
  columns: {
    k: 'text',
    v: 'text',
  },
  uniqueIndexes: ['k'],
});

const toyKvSchema = registerTables([toyKvTable]);

export async function readUserVersion(client: SqlClient): Promise<number> {
  const rows = await client.query(
    raw<{ user_version: number }>('PRAGMA user_version')
  );
  return Number(rows[0]?.user_version ?? 0);
}

/**
 * Toy domain schema. A higher wanted epoch drops the table exactly like the
 * product schema-epoch reset, so harness `expected` must be cleared with it.
 */
export async function migrateToyKv(
  client: SqlClient,
  state: SqlClientWebState
): Promise<void> {
  const epoch = state.epoch;
  const previous = await readUserVersion(client);
  if (Math.floor(previous / VERSION_STRIDE) < epoch) {
    await client.run(raw('DROP TABLE IF EXISTS toy_kv'));
    state.expected.clear();
  }
  await applySqliteSchema(client, toyKvSchema, { ownership: 'declared-only' });
  await client.run(raw(`PRAGMA user_version = ${epoch * VERSION_STRIDE + 1}`));
  state.appliedEpoch = epoch;
}

export async function readToyRows(
  client: SqlClient
): Promise<Map<string, string>> {
  const rows = await client.query(
    sql<{ k: string; v: string }>`SELECT k, v FROM toy_kv`
  );
  return new Map(rows.map((row) => [row.k, row.v]));
}

export async function writeToyRow(
  client: SqlClient,
  key: string,
  value: string
): Promise<void> {
  await client.run(sql`DELETE FROM toy_kv WHERE k = ${key}`);
  await client.run(
    sql`INSERT INTO toy_kv (id, k, v) VALUES (${key}, ${key}, ${value})`
  );
}

export async function readToyRow(
  client: SqlClient,
  key: string
): Promise<string | null> {
  const rows = await client.query(
    sql<{ v: string }>`SELECT v FROM toy_kv WHERE k = ${key}`
  );
  return rows[0]?.v ?? null;
}
