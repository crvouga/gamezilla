import { sql } from '@pkgs/sql';
import { defineQuery } from '@pkgs/sync-engine/shared';
import { z } from 'zod';

import { NOTES_WORLD_TOPIC } from './topics';

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
