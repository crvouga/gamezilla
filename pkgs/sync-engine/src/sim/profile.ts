import { defineSchema } from '@pkgs/db-schema';
import type { Topic } from '@pkgs/pubsub/interface';
import { sql, unsafe } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { z } from 'zod';

import { defineMutation } from '../mutations/core/define-mutation';
import { mutationRegistry } from '../mutations/core/registry';
import { defineQuery } from '../queries/core/define-query';
import { queryRegistry } from '../queries/core/registry';
export const SIM_NOTES_TABLE = 'notes' as const;

export const simNotesSchema = defineSchema({
  tables: {
    notes: {
      id: 'text',
      body: 'text',
      owner_id: 'text',
    },
  },
  uniqueIndexes: [['notes', 'id']],
});

export const simLocalSchema = {
  domainSchema: simNotesSchema,
  cacheTableNames: [SIM_NOTES_TABLE],
} as const;

/** Shared topic so all sim clients receive the same nudge stream. */
export const SIM_WORLD_TOPIC = 'user:sim-world' as Topic;

/** Shared note mutation used by sim clients + server replay. */
export const simSetNote = defineMutation({
  name: 'simSetNote',
  args: z.object({ id: z.string(), body: z.string() }),
  writes: ['notes'],
  invalidates: (): Topic[] => [SIM_WORLD_TOPIC],
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

export const simMutationRegistry = mutationRegistry([simSetNote]);

/** Global notes query — all clients share scope for convergence checks. */
export const simNotesQuery = defineQuery({
  name: 'simNotes',
  params: z.object({}),
  hydrates: ['notes'],
  limit: 500,
  channels: () => [SIM_WORLD_TOPIC],
  async run({ db }) {
    const rows = await db.query(sql<{
      id: string;
      body: string;
      owner_id: string;
    }>`
      SELECT id, body, owner_id FROM notes
      ORDER BY id ASC
      LIMIT ${500}
    `);
    return { notes: rows };
  },
});

export const simQueryRegistry = queryRegistry([simNotesQuery]);

export const SIM_SERVER_DDL = `
CREATE TABLE IF NOT EXISTS notes (
  id text PRIMARY KEY,
  body text NOT NULL DEFAULT '',
  owner_id text NOT NULL DEFAULT '',
  _deleted_at text
);
CREATE TABLE IF NOT EXISTS _mutations_applied (
  mutation_id text PRIMARY KEY,
  client_id text NOT NULL,
  seq bigint NOT NULL,
  status text NOT NULL,
  applied_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS write_rejections (
  id text PRIMARY KEY,
  mutation_id text NOT NULL,
  client_id text NOT NULL,
  code text NOT NULL,
  message text NOT NULL,
  meta jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  acknowledged boolean NOT NULL DEFAULT false
);
`;

export async function applyServerDdl(
  run: (stmt: string) => Promise<void>
): Promise<void> {
  for (const stmt of SIM_SERVER_DDL.split(';')
    .map((s) => s.trim())
    .filter(Boolean)) {
    await run(stmt);
  }
}

export async function applyServerDdlSqlClient(db: SqlClient): Promise<void> {
  await applyServerDdl(async (stmt) => {
    await db.run(unsafe(stmt));
  });
}
