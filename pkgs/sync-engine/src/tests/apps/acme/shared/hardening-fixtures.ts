/**
 * Extra acme-app defs for production-hardening scenarios (schema drift,
 * unknown names, constraint mapping, authorize throw, channel drift).
 */

import { defineTable, registerTables } from '@pkgs/db-schema';
import { sql } from '@pkgs/sql';
import {
  defineMutation,
  defineQuery,
  MutationError,
} from '@pkgs/sync-engine/shared';
import { z } from 'zod';

import type { LocalDomainSchema } from '../../../../client/local-schema-migrate';
import { NOTES_WORLD_TOPIC } from './topics';

/** Schema with optional `notes.color` for column-intersect scenarios. */
export const acmeAppSchemaExtraColumn = registerTables([
  defineTable({
    domain: 'folders',
    name: 'folders',
    columns: { title: 'text', owner_id: 'text' },
  }),
  defineTable({
    domain: 'notes',
    name: 'notes',
    columns: {
      folder_id: 'text',
      space_id: 'text',
      title: 'text',
      body: 'text',
      color: 'text',
      owner_id: 'text',
    },
  }),
  defineTable({
    domain: 'spaces',
    name: 'spaces',
    columns: { title: 'text', owner_id: 'text' },
  }),
  defineTable({
    domain: 'spaces',
    name: 'spaces_users',
    columns: { space_id: 'text', user_id: 'text' },

    uniqueIndexes: [['space_id', 'user_id']],
  }),
  defineTable({
    domain: 'spaces',
    name: 'spaces_open_sessions',
    columns: {
      space_id: 'text',
      device_id: 'text',
      opened_at: 'timestamp',
    },

    uniqueIndexes: [['device_id', 'space_id']],
  }),
]);

export const ACME_APP_TABLES_EXTRA_COLUMN = [
  'folders',
  'notes',
  'spaces',
  'spaces_users',
  'spaces_open_sessions',
] as const;

export const acmeLocalSchemaExtraColumn: LocalDomainSchema = {
  domainSchema: acmeAppSchemaExtraColumn,
  cacheTableNames: ACME_APP_TABLES_EXTRA_COLUMN,
};

/** Schema with an extra `tags` table for mid-life migrate scenarios. */
export const acmeAppSchemaExtraTable = registerTables([
  defineTable({
    domain: 'folders',
    name: 'folders',
    columns: { title: 'text', owner_id: 'text' },
  }),
  defineTable({
    domain: 'notes',
    name: 'notes',
    columns: {
      folder_id: 'text',
      space_id: 'text',
      title: 'text',
      body: 'text',
      owner_id: 'text',
    },

    // Preserve-DB extraColumn → extraTable leaves notes.color on disk.
    deprecations: [['color', 'pbt leftover from extraColumn variant']],
  }),
  defineTable({
    domain: 'tags',
    name: 'tags',
    columns: { label: 'text', owner_id: 'text' },
  }),
  defineTable({
    domain: 'spaces',
    name: 'spaces',
    columns: { title: 'text', owner_id: 'text' },
  }),
  defineTable({
    domain: 'spaces',
    name: 'spaces_users',
    columns: { space_id: 'text', user_id: 'text' },

    uniqueIndexes: [['space_id', 'user_id']],
  }),
  defineTable({
    domain: 'spaces',
    name: 'spaces_open_sessions',
    columns: {
      space_id: 'text',
      device_id: 'text',
      opened_at: 'timestamp',
    },

    uniqueIndexes: [['device_id', 'space_id']],
  }),
]);

export const ACME_APP_TABLES_EXTRA_TABLE = [
  'folders',
  'notes',
  'tags',
  'spaces',
  'spaces_users',
  'spaces_open_sessions',
] as const;

export const acmeLocalSchemaExtraTable: LocalDomainSchema = {
  domainSchema: acmeAppSchemaExtraTable,
  cacheTableNames: ACME_APP_TABLES_EXTRA_TABLE,
};

/** Both `notes.color` and `tags` — mixed-schema multi-client worlds. */
export const acmeAppSchemaExtraColumnAndTable = registerTables([
  defineTable({
    domain: 'folders',
    name: 'folders',
    columns: { title: 'text', owner_id: 'text' },
  }),
  defineTable({
    domain: 'notes',
    name: 'notes',
    columns: {
      folder_id: 'text',
      space_id: 'text',
      title: 'text',
      body: 'text',
      color: 'text',
      owner_id: 'text',
    },
  }),
  defineTable({
    domain: 'tags',
    name: 'tags',
    columns: { label: 'text', owner_id: 'text' },
  }),
  defineTable({
    domain: 'spaces',
    name: 'spaces',
    columns: { title: 'text', owner_id: 'text' },
  }),
  defineTable({
    domain: 'spaces',
    name: 'spaces_users',
    columns: { space_id: 'text', user_id: 'text' },

    uniqueIndexes: [['space_id', 'user_id']],
  }),
  defineTable({
    domain: 'spaces',
    name: 'spaces_open_sessions',
    columns: {
      space_id: 'text',
      device_id: 'text',
      opened_at: 'timestamp',
    },

    uniqueIndexes: [['device_id', 'space_id']],
  }),
]);

export const ACME_APP_TABLES_EXTRA_COLUMN_AND_TABLE = [
  'folders',
  'notes',
  'tags',
  'spaces',
  'spaces_users',
  'spaces_open_sessions',
] as const;

export const acmeLocalSchemaExtraColumnAndTable: LocalDomainSchema = {
  domainSchema: acmeAppSchemaExtraColumnAndTable,
  cacheTableNames: ACME_APP_TABLES_EXTRA_COLUMN_AND_TABLE,
};

/** V2 query name — same hydrate as notesWorld. */
export const notesWorldV2Query = defineQuery({
  name: 'notesWorldV2',
  limit: 500,
  entryChannel: () => [NOTES_WORLD_TOPIC],
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
 * Like notesWorld but SELECTs `color` — for server-extra-column / client-base
 * intersect scenarios (requires acmeLocalSchemaExtraColumn on the server).
 */
export const notesWorldWithColorQuery = defineQuery({
  name: 'notesWorldWithColor',
  limit: 500,
  entryChannel: () => [NOTES_WORLD_TOPIC],
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
      color: string | null;
      owner_id: string;
      deleted_at: string | null;
    }>`
      SELECT id, folder_id, title, body, color, owner_id, deleted_at
      FROM notes
      ORDER BY id ASC
`);
    return { folders, notes };
  },
});

/** Params query for scope-hash key-order scenarios. */
export const notesByFolderQuery = defineQuery({
  name: 'notesByFolder',
  params: z.object({
    folderId: z.string(),
    includeArchived: z.boolean().optional(),
  }),
  limit: 500,
  entryChannel: () => [NOTES_WORLD_TOPIC],
  async run({ db }, params) {
    const notes = await db.query(sql<{
      id: string;
      folder_id: string | null;
      title: string;
      body: string;
      owner_id: string;
      deleted_at: string | null;
    }>`
      SELECT id, folder_id, title, body, owner_id, deleted_at FROM notes
      WHERE folder_id = ${params.folderId}
      ORDER BY id ASC
`);
    return { notes };
  },
});

/** authorize throws — must behave as denied. */
export const notesAuthorizeThrowQuery = defineQuery({
  name: 'notesAuthorizeThrow',
  limit: 500,
  entryChannel: () => [NOTES_WORLD_TOPIC],
  authorize: async () => {
    throw new Error('authorize exploded');
  },
  async run() {
    return { folders: [], notes: [] };
  },
});

/** Hydrates tags — used after mid-life schema add. */
export const tagsWorldQuery = defineQuery({
  name: 'tagsWorld',
  limit: 500,
  entryChannel: () => [NOTES_WORLD_TOPIC],
  async run({ db }) {
    const tags = await db.query(sql<{
      id: string;
      label: string;
      owner_id: string;
      deleted_at: string | null;
    }>`
      SELECT id, label, owner_id, deleted_at FROM tags
      ORDER BY id ASC
`);
    return { tags };
  },
});

/** Client-only ghost mutation — not registered on server. */
export const ghostMutation = defineMutation({
  name: 'ghostMutation',
  args: z.object({ id: z.string(), body: z.string() }),
  async run({ tx, env }, { id, body }) {
    await tx.run(sql`
      INSERT INTO notes (id, folder_id, title, body, owner_id)
      VALUES (${id}, ${null}, ${''}, ${body}, ${env.actorId})
      ON CONFLICT (id) DO UPDATE SET
        body = excluded.body,
        owner_id = excluded.owner_id,
        deleted_at = NULL
    `);
  },
});

/** Tightened args — body must be non-empty and max 32 chars. */
export const setNoteArgsTight = defineMutation({
  name: 'setNoteArgsTight',
  args: z.object({
    id: z.string(),
    body: z.string().min(1).max(32),
  }),
  async run({ tx, env }, { id, body }) {
    await tx.run(sql`
      INSERT INTO notes (id, folder_id, title, body, owner_id)
      VALUES (${id}, ${null}, ${''}, ${body}, ${env.actorId})
      ON CONFLICT (id) DO UPDATE SET
        body = excluded.body,
        owner_id = excluded.owner_id,
        deleted_at = NULL
    `);
  },
});

/**
 * Loose client-side twin of setNoteArgsTight (same wire name) for stale-args
 * scenarios — client accepts long body; server tight rejects.
 */
export const setNoteArgsLoose = defineMutation({
  name: 'setNoteArgsTight',
  args: z.object({
    id: z.string(),
    body: z.string(),
  }),
  async run({ tx, env }, { id, body }) {
    await tx.run(sql`
      INSERT INTO notes (id, folder_id, title, body, owner_id)
      VALUES (${id}, ${null}, ${''}, ${body}, ${env.actorId})
      ON CONFLICT (id) DO UPDATE SET
        body = excluded.body,
        owner_id = excluded.owner_id,
        deleted_at = NULL
    `);
  },
});

/** Unique slug note — constraintErrors maps SQLite/PG unique violations. */
export const setNoteUniqueSlug = defineMutation({
  name: 'setNoteUniqueSlug',
  args: z.object({
    id: z.string(),
    slug: z.string(),
    body: z.string(),
  }),
  constraintErrors: {
    notes_title_unique: {
      code: 'SLUG_TAKEN',
      message: 'Slug already in use',
    },
  },
  async run({ tx, env }, { id, slug, body }) {
    const taken = await tx.query(sql<{ id: string }>`
      SELECT id FROM notes
      WHERE title = ${slug} AND id != ${id} AND deleted_at IS NULL
    `);
    if (taken[0] !== undefined) {
      throw Object.assign(new Error('unique_violation'), {
        code: '23505',
        constraint: 'notes_title_unique',
      });
    }
    await tx.run(sql`
      INSERT INTO notes (id, folder_id, title, body, owner_id)
      VALUES (${id}, ${null}, ${slug}, ${body}, ${env.actorId})
      ON CONFLICT (id) DO UPDATE SET
        title = excluded.title,
        body = excluded.body,
        owner_id = excluded.owner_id,
        deleted_at = NULL
    `);
  },
});

/** Writes folders + notes — historically undeclared folder write footgun. */
export const setNoteUndeclaredFolderWrite = defineMutation({
  name: 'setNoteUndeclaredFolderWrite',
  args: z.object({
    noteId: z.string(),
    folderId: z.string(),
    folderTitle: z.string(),
    body: z.string(),
  }),
  async run({ tx, env }, { noteId, folderId, folderTitle, body }) {
    await tx.run(sql`
      INSERT INTO folders (id, title, owner_id)
      VALUES (${folderId}, ${folderTitle}, ${env.actorId})
      ON CONFLICT (id) DO UPDATE SET
        title = excluded.title,
        owner_id = excluded.owner_id,
        deleted_at = NULL
    `);
    await tx.run(sql`
      INSERT INTO notes (id, folder_id, title, body, owner_id)
      VALUES (${noteId}, ${folderId}, ${''}, ${body}, ${env.actorId})
      ON CONFLICT (id) DO UPDATE SET
        folder_id = excluded.folder_id,
        body = excluded.body,
        owner_id = excluded.owner_id,
        deleted_at = NULL
    `);
  },
});

/** Note upsert kept for wrong-topic / peer-stale scenarios. */
export const setNoteWrongTopic = defineMutation({
  name: 'setNoteWrongTopic',
  args: z.object({ id: z.string(), body: z.string() }),
  async run({ tx, env }, { id, body }) {
    await tx.run(sql`
      INSERT INTO notes (id, folder_id, title, body, owner_id)
      VALUES (${id}, ${null}, ${''}, ${body}, ${env.actorId})
      ON CONFLICT (id) DO UPDATE SET
        body = excluded.body,
        owner_id = excluded.owner_id,
        deleted_at = NULL
    `);
  },
});

/** Set note color (extra-column schema). */
export const setNoteColor = defineMutation({
  name: 'setNoteColor',
  args: z.object({
    id: z.string(),
    body: z.string(),
    color: z.string(),
  }),
  async run({ tx, env }, { id, body, color }) {
    await tx.run(sql`
      INSERT INTO notes (id, folder_id, title, body, color, owner_id)
      VALUES (${id}, ${null}, ${''}, ${body}, ${color}, ${env.actorId})
      ON CONFLICT (id) DO UPDATE SET
        body = excluded.body,
        color = excluded.color,
        owner_id = excluded.owner_id,
        deleted_at = NULL
    `);
  },
});

export const setTag = defineMutation({
  name: 'setTag',
  args: z.object({ id: z.string(), label: z.string() }),
  async run({ tx, env }, { id, label }) {
    await tx.run(sql`
      INSERT INTO tags (id, label, owner_id)
      VALUES (${id}, ${label}, ${env.actorId})
      ON CONFLICT (id) DO UPDATE SET
        label = excluded.label,
        owner_id = excluded.owner_id,
        deleted_at = NULL
    `);
  },
});

/** Rebase-fail mutation: after peer delete, update of missing row throws. */
export const setNoteStrictExists = defineMutation({
  name: 'setNoteStrictExists',
  args: z.object({ id: z.string(), body: z.string() }),
  async run({ tx, env }, { id, body }) {
    const rows = await tx.query(sql<{ id: string }>`
      SELECT id FROM notes WHERE id = ${id} AND deleted_at IS NULL
    `);
    if (rows[0] === undefined) {
      throw new MutationError('NOT_FOUND', 'Note missing for strict update');
    }
    await tx.run(sql`
      UPDATE notes SET body = ${body}, owner_id = ${env.actorId}
      WHERE id = ${id} AND deleted_at IS NULL
    `);
  },
});

/**
 * Touch many existing notes in one mutation so a single push can hit the
 * fanout row cap (batch size alone cannot exceed that cap).
 */
export const retouchNotes = defineMutation({
  name: 'retouchNotes',
  args: z.object({
    ids: z.array(z.string()).min(1),
    body: z.string(),
  }),
  async run({ tx, env }, { ids, body }) {
    for (const id of ids) {
      await tx.run(sql`
        UPDATE notes
        SET body = ${body}, owner_id = ${env.actorId}
        WHERE id = ${id} AND deleted_at IS NULL
      `);
    }
  },
});
