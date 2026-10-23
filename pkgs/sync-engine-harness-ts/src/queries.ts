import sql from '@pkgs/sql-root-shared-ts/sql';
import { defineQuery } from '@pkgs/sync-engine-shared-ts/define-query';

import { NOTES_ALL_TOPIC } from './topics';

/** Folder id used as mid-session authorize gate for {@link notesOwnedQuery}. */
export const NOTES_AUTH_GATE_FOLDER_ID = '__auth_gate__';

/**
 * Global notes+folders hydrate — all harness clients share scope for
 * convergence checks. Snapshots include soft-deleted rows (tombstones).
 */
export const notesAllQuery = defineQuery({
  name: 'notesAll',
  limit: 500,
  entryChannel: () => [NOTES_ALL_TOPIC],
  async run({ db }) {
    const folders = await db.query(sql<{
      id: string;
      title: string;
      owner_id: string;
      deleted_at: string | null;
    }>`
      SELECT id, title, owner_id, deleted_at FROM folders
      ORDER BY id ASC
`);
    const notes = await db.query(sql<{
      id: string;
      folder_id: string | null;
      title: string;
      body: string;
      owner_id: string;
      deleted_at: string | null;
    }>`
      SELECT id, folder_id, title, body, owner_id, deleted_at FROM notes
      ORDER BY id ASC
`);
    return { folders, notes };
  },
});

/** Chess-scale hydrate for large-snapshot DST pins (limit above default 2k). */
export const notesLargeAllQuery = defineQuery({
  name: 'notesLargeAll',
  limit: 2_500,
  entryChannel: () => [NOTES_ALL_TOPIC],
  async run({ db }) {
    const folders = await db.query(sql<{
      id: string;
      title: string;
      owner_id: string;
      deleted_at: string | null;
    }>`
      SELECT id, title, owner_id, deleted_at FROM folders
      ORDER BY id ASC
`);
    const notes = await db.query(sql<{
      id: string;
      folder_id: string | null;
      title: string;
      body: string;
      owner_id: string;
      deleted_at: string | null;
    }>`
      SELECT id, folder_id, title, body, owner_id, deleted_at FROM notes
      ORDER BY id ASC
`);
    return { folders, notes };
  },
});

/**
 * Always denied — used to exercise detachScope on query deny without wiping
 * domain rows hydrated by notesAll.
 */
export const notesDeniedQuery = defineQuery({
  name: 'notesDenied',
  limit: 500,
  entryChannel: () => [NOTES_ALL_TOPIC],
  authorize: async () => false,
  async run({ db }) {
    const folders = await db.query(sql<{
      id: string;
      title: string;
      owner_id: string;
      deleted_at: string | null;
    }>`
      SELECT id, title, owner_id, deleted_at FROM folders
      ORDER BY id ASC
`);
    const notes = await db.query(sql<{
      id: string;
      folder_id: string | null;
      title: string;
      body: string;
      owner_id: string;
      deleted_at: string | null;
    }>`
      SELECT id, folder_id, title, body, owner_id, deleted_at FROM notes
      ORDER BY id ASC
`);
    return { folders, notes };
  },
});

/**
 * Hard row budget of 5 — truncation / limit scenarios.
 */
export const notesLimitedQuery = defineQuery({
  name: 'notesLimited',
  limit: 5,
  entryChannel: () => [NOTES_ALL_TOPIC],
  async run({ db }) {
    const notes = await db.query(sql<{
      id: string;
      folder_id: string | null;
      title: string;
      body: string;
      owner_id: string;
      deleted_at: string | null;
    }>`
      SELECT id, folder_id, title, body, owner_id, deleted_at FROM notes
      ORDER BY id ASC
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
  limit: 500,
  entryChannel: () => [NOTES_ALL_TOPIC],
  authorize: async ({ db, env }) => {
    const rows = await db.query(sql<{ owner_id: string }>`
      SELECT owner_id FROM folders
      WHERE id = ${NOTES_AUTH_GATE_FOLDER_ID} AND deleted_at IS NULL
    `);
    return rows[0]?.['owner_id'] === env.actorId;
  },
  async run({ db }) {
    const folders = await db.query(sql<{
      id: string;
      title: string;
      owner_id: string;
      deleted_at: string | null;
    }>`
      SELECT id, title, owner_id, deleted_at FROM folders
      ORDER BY id ASC
`);
    const notes = await db.query(sql<{
      id: string;
      folder_id: string | null;
      title: string;
      body: string;
      owner_id: string;
      deleted_at: string | null;
    }>`
      SELECT id, folder_id, title, body, owner_id, deleted_at FROM notes
      ORDER BY id ASC
`);
    return { folders, notes };
  },
});

/** Notes-only hydrate — push table-filter wake scenarios. */
export const notesOnlyQuery = defineQuery({
  name: 'notesOnly',
  limit: 500,
  entryChannel: () => [NOTES_ALL_TOPIC],
  async run({ db }) {
    const notes = await db.query(sql<{
      id: string;
      folder_id: string | null;
      title: string;
      body: string;
      owner_id: string;
      deleted_at: string | null;
    }>`
      SELECT id, folder_id, title, body, owner_id, deleted_at FROM notes
      ORDER BY id ASC
`);
    return { notes };
  },
});

/** Folders-only hydrate — push table-filter wake scenarios. */
export const foldersOnlyQuery = defineQuery({
  name: 'foldersOnly',
  limit: 500,
  entryChannel: () => [NOTES_ALL_TOPIC],
  async run({ db }) {
    const folders = await db.query(sql<{
      id: string;
      title: string;
      owner_id: string;
      deleted_at: string | null;
    }>`
      SELECT id, title, owner_id, deleted_at FROM folders
      ORDER BY id ASC
`);
    return { folders };
  },
});

/** Actor-scoped profile hydrate — same-account fanout scrub scenarios. */
export const ownProfileQuery = defineQuery({
  name: 'ownProfile',
  limit: 1,
  async run({ db, env }) {
    const profile = await db.query(sql<{
      id: string;
      username: string;
      username_norm: string;
      deleted_at: string | null;
    }>`
      SELECT id, username, username_norm, deleted_at FROM profile
      WHERE id = ${env.actorId}
`);
    return { profile };
  },
});

export const OWN_PROFILE_SESSION = {
  name: 'ownProfile',
  params: {},
} as const;
