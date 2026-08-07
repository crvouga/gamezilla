import type { Topic } from '@pkgs/pubsub/interface';
import { sql } from '@pkgs/sql';
import { defineMutation, MutationError } from '@pkgs/sync-engine/shared';
import { z } from 'zod';

import { NOTES_WORLD_TOPIC } from './topics';

const worldTopics = (): Topic[] => [NOTES_WORLD_TOPIC];

/** Upsert a folder (revive clears tombstone). */
export const setFolder = defineMutation({
  name: 'setFolder',
  args: z.object({ id: z.string(), title: z.string() }),
  declaredWrites: ['folders'],
  invalidates: worldTopics,
  affectedRows: ({ id }) => ({ folders: [id] }),
  async run({ tx, env }, { id, title }) {
    await tx.run(sql`
      INSERT INTO folders (id, title, owner_id)
      VALUES (${id}, ${title}, ${env.actorId})
      ON CONFLICT (id) DO UPDATE SET
        title = excluded.title,
        owner_id = excluded.owner_id,
        _deleted_at = NULL
    `);
  },
});

/** Soft-delete a folder owned by the actor. */
export const deleteFolder = defineMutation({
  name: 'deleteFolder',
  args: z.object({ id: z.string() }),
  declaredWrites: ['folders'],
  invalidates: worldTopics,
  affectedRows: ({ id }) => ({ folders: [id] }),
  async run({ tx, env }, { id }) {
    const rows = await tx.query(sql<{ owner_id: string }>`
      SELECT owner_id FROM folders
      WHERE id = ${id} AND _deleted_at IS NULL
    `);
    const row = rows[0];
    if (row === undefined) return;
    if (row.owner_id !== env.actorId) {
      throw new MutationError('FORBIDDEN', 'Only the folder owner can delete');
    }
    await tx.run(sql`
      UPDATE folders
      SET _deleted_at = ${env.now().toISOString()}
      WHERE id = ${id} AND _deleted_at IS NULL
    `);
  },
});

/** Upsert a note (revive clears tombstone). */
export const setNote = defineMutation({
  name: 'setNote',
  args: z.object({
    id: z.string(),
    title: z.string().optional(),
    body: z.string(),
    folderId: z.string().nullable().optional(),
  }),
  declaredWrites: ['notes'],
  invalidates: worldTopics,
  affectedRows: ({ id }) => ({ notes: [id] }),
  async run({ tx, env }, { id, title, body, folderId }) {
    const folder = folderId ?? null;
    const noteTitle = title ?? '';
    await tx.run(sql`
      INSERT INTO notes (id, folder_id, title, body, owner_id)
      VALUES (${id}, ${folder}, ${noteTitle}, ${body}, ${env.actorId})
      ON CONFLICT (id) DO UPDATE SET
        folder_id = excluded.folder_id,
        title = excluded.title,
        body = excluded.body,
        owner_id = excluded.owner_id,
        _deleted_at = NULL
    `);
  },
});

/** Soft-delete a note owned by the actor. */
export const deleteNote = defineMutation({
  name: 'deleteNote',
  args: z.object({ id: z.string() }),
  declaredWrites: ['notes'],
  invalidates: worldTopics,
  affectedRows: ({ id }) => ({ notes: [id] }),
  async run({ tx, env }, { id }) {
    const rows = await tx.query(sql<{ owner_id: string }>`
      SELECT owner_id FROM notes
      WHERE id = ${id} AND _deleted_at IS NULL
    `);
    const row = rows[0];
    if (row === undefined) return;
    if (row.owner_id !== env.actorId) {
      throw new MutationError('FORBIDDEN', 'Only the note owner can delete');
    }
    await tx.run(sql`
      UPDATE notes
      SET _deleted_at = ${env.now().toISOString()}
      WHERE id = ${id} AND _deleted_at IS NULL
    `);
  },
});

/** Move a live note into a folder (or root when folderId is null). */
export const moveNote = defineMutation({
  name: 'moveNote',
  args: z.object({
    id: z.string(),
    folderId: z.string().nullable(),
  }),
  declaredWrites: ['notes'],
  invalidates: worldTopics,
  affectedRows: ({ id }) => ({ notes: [id] }),
  async run({ tx, env }, { id, folderId }) {
    await tx.run(sql`
      UPDATE notes
      SET folder_id = ${folderId}, owner_id = ${env.actorId}
      WHERE id = ${id} AND _deleted_at IS NULL
    `);
  },
});

/**
 * Intentionally illegal domain hard-delete — sync-engine must reject with
 * NO_HARD_DELETE. Used only by black-box guard scenarios.
 */
export const illegalHardDeleteNote = defineMutation({
  name: 'illegalHardDeleteNote',
  args: z.object({ id: z.string() }),
  declaredWrites: ['notes'],
  invalidates: worldTopics,
  affectedRows: ({ id }) => ({ notes: [id] }),
  async run({ tx }, { id }) {
    await tx.run(sql`DELETE FROM notes WHERE id = ${id}`);
  },
});

/**
 * Local apply succeeds; server replay always rejects (env.serverNow is set
 * only on server). Used to exercise upload write_rejection drain.
 * Prefer mutating an existing server row so snapshot merge can restore it.
 */
export const serverRejectNote = defineMutation({
  name: 'serverRejectNote',
  args: z.object({ id: z.string(), body: z.string() }),
  declaredWrites: ['notes'],
  invalidates: worldTopics,
  affectedRows: ({ id }) => ({ notes: [id] }),
  async run({ tx, env }, { id, body }) {
    if (env.serverNow !== undefined) {
      throw new MutationError('FORBIDDEN', 'Server rejects this mutation');
    }
    await tx.run(sql`
      INSERT INTO notes (id, folder_id, title, body, owner_id)
      VALUES (${id}, ${null}, ${''}, ${body}, ${env.actorId})
      ON CONFLICT (id) DO UPDATE SET
        body = excluded.body,
        owner_id = excluded.owner_id,
        _deleted_at = NULL
    `);
  },
});

/**
 * Like setNote but requires connectivity — used by requires-online scenarios.
 */
export const requiresOnlineNote = defineMutation({
  name: 'requiresOnlineNote',
  args: z.object({
    id: z.string(),
    body: z.string(),
  }),
  declaredWrites: ['notes'],
  requiresOnline: true,
  invalidates: worldTopics,
  affectedRows: ({ id }) => ({ notes: [id] }),
  async run({ tx, env }, { id, body }) {
    await tx.run(sql`
      INSERT INTO notes (id, folder_id, title, body, owner_id)
      VALUES (${id}, ${null}, ${''}, ${body}, ${env.actorId})
      ON CONFLICT (id) DO UPDATE SET
        body = excluded.body,
        owner_id = excluded.owner_id,
        _deleted_at = NULL
    `);
  },
});

/**
 * V2 wire name for setNote — coexistence / versioning scenarios.
 * Same SQL semantics; keep setNote until clients migrate.
 */
export const setNoteV2 = defineMutation({
  name: 'setNoteV2',
  args: z.object({
    id: z.string(),
    title: z.string().optional(),
    body: z.string(),
    folderId: z.string().nullable().optional(),
  }),
  declaredWrites: ['notes'],
  invalidates: worldTopics,
  affectedRows: ({ id }) => ({ notes: [id] }),
  async run({ tx, env }, { id, title, body, folderId }) {
    const folder = folderId ?? null;
    const noteTitle = title ?? '';
    await tx.run(sql`
      INSERT INTO notes (id, folder_id, title, body, owner_id)
      VALUES (${id}, ${folder}, ${noteTitle}, ${body}, ${env.actorId})
      ON CONFLICT (id) DO UPDATE SET
        folder_id = excluded.folder_id,
        title = excluded.title,
        body = excluded.body,
        owner_id = excluded.owner_id,
        _deleted_at = NULL
    `);
  },
});

/**
 * Like setNote but omits affectedRows — pushSeq-only wake (no row images).
 */
export const setNoteNoFanout = defineMutation({
  name: 'setNoteNoFanout',
  args: z.object({
    id: z.string(),
    title: z.string().optional(),
    body: z.string(),
    folderId: z.string().nullable().optional(),
  }),
  declaredWrites: ['notes'],
  invalidates: worldTopics,
  async run({ tx, env }, { id, title, body, folderId }) {
    const folder = folderId ?? null;
    const noteTitle = title ?? '';
    await tx.run(sql`
      INSERT INTO notes (id, folder_id, title, body, owner_id)
      VALUES (${id}, ${folder}, ${noteTitle}, ${body}, ${env.actorId})
      ON CONFLICT (id) DO UPDATE SET
        folder_id = excluded.folder_id,
        title = excluded.title,
        body = excluded.body,
        owner_id = excluded.owner_id,
        _deleted_at = NULL
    `);
  },
});
