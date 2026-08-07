import { Database } from 'bun:sqlite';
import { sql, unsafe } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { SqlClientImplBunSqlite } from '@pkgs/sql-client/sqlite/impl-bun-sqlite';
import { createMutationClient } from '@pkgs/sync-engine/mutations/client/create-mutation-client';

import { defineMutation } from '@pkgs/sync-engine/mutations/core/define-mutation';
import { registry } from '@pkgs/sync-engine/mutations/core/registry';
import { MutationError } from '@pkgs/sync-engine/mutations/core/types';
import { z } from 'zod';
import { ensureFrameworkSchema } from '../client/local-schema';
import type { MergeApplierDeps } from '../client/merge-applier';
import { createTableChangeBus } from '../client/table-change-bus';
import { bumpWriteEpoch } from '../client/write-epoch';
import { scopeHash } from '../shared/canonical';

export const DOMAIN_DDL = `
CREATE TABLE IF NOT EXISTS notes (
  id TEXT PRIMARY KEY,
  body TEXT NOT NULL DEFAULT '',
  owner_id TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS rooms (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS write_rejections (
  id TEXT PRIMARY KEY,
  mutation_id TEXT NOT NULL,
  client_id TEXT NOT NULL,
  code TEXT NOT NULL,
  message TEXT NOT NULL,
  meta TEXT,
  created_at TEXT NOT NULL,
  acknowledged INTEGER NOT NULL DEFAULT 0
);
`;

export async function openScenarioDb(): Promise<SqlClient> {
  const raw = new Database(':memory:');
  const db = new SqlClientImplBunSqlite(raw);
  await db.connect();
  for (const stmt of DOMAIN_DDL.split(';')
    .map((s) => s.trim())
    .filter(Boolean)) {
    await db.run(unsafe(stmt));
  }
  await ensureFrameworkSchema(db);
  return db;
}

export const setNote = defineMutation({
  name: 'setNote',
  args: z.object({ id: z.string(), body: z.string() }),
  writes: ['notes'],
  async run({ tx, env }, { id, body }) {
    await tx.run(sql`
      INSERT INTO notes (id, body, owner_id)
      VALUES (${id}, ${body}, ${env.actorId})
      ON CONFLICT (id) DO UPDATE SET
        body = excluded.body,
        owner_id = excluded.owner_id
    `);
  },
});

export const bumpNoteForbidden = defineMutation({
  name: 'bumpNoteForbidden',
  args: z.object({ id: z.string() }),
  writes: ['notes'],
  async run() {
    throw new MutationError('FORBIDDEN', 'nope');
  },
});

export const failOnRebase = defineMutation({
  name: 'failOnRebase',
  args: z.object({ id: z.string(), body: z.string() }),
  writes: ['notes'],
  async run({ tx }, { id, body }) {
    const rows = await tx.query(sql<{ body: string }>`
      SELECT body FROM notes WHERE id = ${id}
    `);
    if (rows[0]?.body === 'BLOCK') {
      throw new MutationError('BLOCKED', 'blocked by confirmed state');
    }
    await tx.run(sql`
      INSERT INTO notes (id, body, owner_id)
      VALUES (${id}, ${body}, ${'actor'})
      ON CONFLICT (id) DO UPDATE SET body = excluded.body
    `);
  },
});

export const scenarioRegistry = registry([
  setNote,
  bumpNoteForbidden,
  failOnRebase,
]);

export function scenarioEnv(actorId = 'actor') {
  return {
    actorId,
    deviceId: 'device-1',
    accountId: 'acct-1' as string | null,
    isAnon: false,
    now: () => new Date('2026-01-01T00:00:00.000Z'),
  };
}

export function createScenarioClients(db: SqlClient) {
  let seq = 0;
  const bus = createTableChangeBus();
  const env = scenarioEnv();
  const mutateClient = createMutationClient({
    db,
    registry: scenarioRegistry,
    env,
    ids: {
      clientId: 'device-1',
      nextSeq: () => {
        seq += 1;
        return seq;
      },
    },
    connectivity: { isOnline: () => true },
  });
  const mergeDeps: MergeApplierDeps = {
    db,
    registry: scenarioRegistry,
    env,
    bus,
    clientId: 'device-1',
  };
  return { mutateClient, mergeDeps, bus, env, scopeHash };
}

/** Soft-ack uploaded mutations through seq (keeps rebase log). */
export async function softAckThrough(
  db: SqlClient,
  seq: number
): Promise<number> {
  let ackedEpoch = 0;
  await db.transaction(async (tx) => {
    ackedEpoch = await bumpWriteEpoch(tx);
    await tx.run(sql`
      UPDATE _upload_state
      SET last_acked_seq = MAX(last_acked_seq, ${seq})
      WHERE id = ${'singleton'}
    `);
    await tx.run(sql`
      UPDATE _mutations
      SET status = ${'uploaded'}, acked_epoch = ${ackedEpoch}
      WHERE seq <= ${seq} AND status = ${'pending'}
    `);
  });
  return ackedEpoch;
}

/** Hard-delete rejected mutations through seq (no rebase). */
export async function rejectThrough(db: SqlClient, seq: number): Promise<void> {
  await db.run(sql`
    UPDATE _upload_state SET last_acked_seq = ${seq} WHERE id = ${'singleton'}
  `);
  await db.run(sql`
    DELETE FROM _mutations WHERE seq <= ${seq}
  `);
}

/** @deprecated use softAckThrough / rejectThrough */
export async function ackThrough(db: SqlClient, seq: number): Promise<void> {
  await rejectThrough(db, seq);
}

export async function readWriteEpochFixture(db: SqlClient): Promise<number> {
  const rows = await db.query(sql<{ write_epoch: number }>`
    SELECT write_epoch FROM _upload_state WHERE id = ${'singleton'} LIMIT 1
  `);
  return Number(rows[0]?.write_epoch ?? 0);
}
