import { Database } from 'bun:sqlite';
import { sql, unsafe } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { SqlClientImplBunSqlite } from '@pkgs/sql-client/sqlite/impl-bun-sqlite';
import { z } from 'zod';
import type { MergeApplierDeps } from '../../client/merge';
import { createMutationClient } from '../../mutations/client/create-mutation-client';
import { defineMutation } from '../../mutations/core/define-mutation';
import { mutationRegistry } from '../../mutations/core/registry';
import { MutationError } from '../../mutations/core/types';
import { FRAMEWORK_LOCAL_DDL } from '../client/local-schema';
import { createTableChangeBus } from '../client/table-change-bus';
import { scopeHash } from '../shared/canonical';

export const DOMAIN_DDL = `
CREATE TABLE IF NOT EXISTS notes (
  id TEXT PRIMARY KEY,
  body TEXT NOT NULL DEFAULT '',
  owner_id TEXT NOT NULL DEFAULT '',
  _deleted_at TEXT
);
CREATE TABLE IF NOT EXISTS rooms (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL DEFAULT '',
  _deleted_at TEXT
);
`;

export async function openScenarioDb(): Promise<SqlClient> {
  const raw = new Database(':memory:');
  const db = new SqlClientImplBunSqlite(raw);
  await db.connect();
  for (const stmt of `${DOMAIN_DDL}\n${FRAMEWORK_LOCAL_DDL}`
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean)) {
    await db.run(unsafe(stmt));
  }
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

export const scenarioRegistry = mutationRegistry([
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
  const bus = createTableChangeBus();
  const env = scenarioEnv();
  const mutateClient = createMutationClient({
    db,
    registry: scenarioRegistry,
    env,
    ids: { clientId: 'device-1' },
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
