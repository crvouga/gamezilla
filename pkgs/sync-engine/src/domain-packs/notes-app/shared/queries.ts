import { sql } from '@pkgs/sql';
import { defineQuery } from '@pkgs/sync-engine/shared';
import { z } from 'zod';

import { NOTES_WORLD_TOPIC } from './topics';

/** Folder id used as mid-session authorize gate for {@link notesOwnedQuery}. */
export const NOTES_AUTH_GATE_FOLDER_ID = '__auth_gate__';

/**
 * Global notes+folders hydrate — all sim clients share scope for
 * convergence checks. Snapshots include soft-deleted rows (tombstones).
 */
export const notesWorldQuery = defineQuery({
  name: 'notesWorld',
  params: z.object({}),
  hydrates: ['folders', 'notes'],
  limit: 500,
  channels: () => [NOTES_WORLD_TOPIC],
  async run({ db }) {
    const folders = await db.query(sql<{
      id: string;
      title: string;
      owner_id: string;
      _deleted_at: string | null;
    }>`
      SELECT id, title, owner_id, _deleted_at FROM folders
      ORDER BY id ASC
      LIMIT ${500}
    `);
    const notes = await db.query(sql<{
      id: string;
      folder_id: string | null;
      title: string;
      body: string;
      owner_id: string;
      _deleted_at: string | null;
    }>`
      SELECT id, folder_id, title, body, owner_id, _deleted_at FROM notes
      ORDER BY id ASC
      LIMIT ${500}
    `);
    return { folders, notes };
  },
});

/**
 * Always denied — used to exercise detachScope on query deny without wiping
 * domain rows hydrated by notesWorld.
 */
export const notesDeniedQuery = defineQuery({
  name: 'notesDenied',
  params: z.object({}),
  hydrates: ['folders', 'notes'],
  limit: 500,
  channels: () => [NOTES_WORLD_TOPIC],
  authorize: async () => false,
  async run({ db }) {
    const folders = await db.query(sql<{
      id: string;
      title: string;
      owner_id: string;
      _deleted_at: string | null;
    }>`
      SELECT id, title, owner_id, _deleted_at FROM folders
      ORDER BY id ASC
      LIMIT ${500}
    `);
    const notes = await db.query(sql<{
      id: string;
      folder_id: string | null;
      title: string;
      body: string;
      owner_id: string;
      _deleted_at: string | null;
    }>`
      SELECT id, folder_id, title, body, owner_id, _deleted_at FROM notes
      ORDER BY id ASC
      LIMIT ${500}
    `);
    return { folders, notes };
  },
});

/**
 * Hard row budget of 5 — truncation / limit scenarios.
 */
export const notesLimitedQuery = defineQuery({
  name: 'notesLimited',
  params: z.object({}),
  hydrates: ['notes'],
  limit: 5,
  channels: () => [NOTES_WORLD_TOPIC],
  async run({ db }) {
    const notes = await db.query(sql<{
      id: string;
      folder_id: string | null;
      title: string;
      body: string;
      owner_id: string;
      _deleted_at: string | null;
    }>`
      SELECT id, folder_id, title, body, owner_id, _deleted_at FROM notes
      ORDER BY id ASC
      LIMIT ${5}
    `);
    return { notes };
  },
});

/**
 * Authorized while the gate folder is owned by the actor. Steal ownership
 * mid-session (setFolder) → next refetch returns denied.
 */
export const notesOwnedQuery = defineQuery({
  name: 'notesOwned',
  params: z.object({}),
  hydrates: ['folders', 'notes'],
  limit: 500,
  channels: () => [NOTES_WORLD_TOPIC],
  authorize: async ({ db, env }) => {
    const rows = await db.query(sql<{ owner_id: string }>`
      SELECT owner_id FROM folders
      WHERE id = ${NOTES_AUTH_GATE_FOLDER_ID} AND _deleted_at IS NULL
    `);
    return rows[0]?.['owner_id'] === env.actorId;
  },
  async run({ db }) {
    const folders = await db.query(sql<{
      id: string;
      title: string;
      owner_id: string;
      _deleted_at: string | null;
    }>`
      SELECT id, title, owner_id, _deleted_at FROM folders
      ORDER BY id ASC
      LIMIT ${500}
    `);
    const notes = await db.query(sql<{
      id: string;
      folder_id: string | null;
      title: string;
      body: string;
      owner_id: string;
      _deleted_at: string | null;
    }>`
      SELECT id, folder_id, title, body, owner_id, _deleted_at FROM notes
      ORDER BY id ASC
      LIMIT ${500}
    `);
    return { folders, notes };
  },
});

/** Notes-only hydrate — push table-filter wake scenarios. */
export const notesOnlyQuery = defineQuery({
  name: 'notesOnly',
  params: z.object({}),
  hydrates: ['notes'],
  limit: 500,
  channels: () => [NOTES_WORLD_TOPIC],
  async run({ db }) {
    const notes = await db.query(sql<{
      id: string;
      folder_id: string | null;
      title: string;
      body: string;
      owner_id: string;
      _deleted_at: string | null;
    }>`
      SELECT id, folder_id, title, body, owner_id, _deleted_at FROM notes
      ORDER BY id ASC
      LIMIT ${500}
    `);
    return { notes };
  },
});

/** Folders-only hydrate — push table-filter wake scenarios. */
export const foldersOnlyQuery = defineQuery({
  name: 'foldersOnly',
  params: z.object({}),
  hydrates: ['folders'],
  limit: 500,
  channels: () => [NOTES_WORLD_TOPIC],
  async run({ db }) {
    const folders = await db.query(sql<{
      id: string;
      title: string;
      owner_id: string;
      _deleted_at: string | null;
    }>`
      SELECT id, title, owner_id, _deleted_at FROM folders
      ORDER BY id ASC
      LIMIT ${500}
    `);
    return { folders };
  },
});
