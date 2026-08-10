import { defineSchema } from '@pkgs/db-schema';

/**
 * Tiny notes app domain schema for black-box sync-engine scenarios.
 * Managed columns (`id`, `created_at`, `updated_at`, `deleted_at`) are
 * implicit via `@pkgs/db-schema`.
 *
 * `spaces` / `space_users` mirror product membership table names so
 * `attachPush` table-change hooks schedule topic sync.
 */
export const notesAppSchema = defineSchema({
  tables: {
    folders: {
      title: 'text',
      owner_id: 'text',
    },
    notes: {
      folder_id: 'text',
      space_id: 'text',
      title: 'text',
      body: 'text',
      owner_id: 'text',
    },
    spaces: {
      title: 'text',
      owner_id: 'text',
    },
    space_users: {
      space_id: 'text',
      user_id: 'text',
    },
    /** Install-local "space is open here" — device-scoped, not user-scoped. */
    space_open_sessions: {
      space_id: 'text',
      device_id: 'text',
      opened_at: 'timestamp',
    },
  },
  uniqueIndexes: [
    ['space_users', 'space_id', 'user_id'],
    ['space_open_sessions', 'device_id', 'space_id'],
  ],
  indexes: [
    ['notes', 'folder_id'],
    ['notes', 'owner_id'],
    ['notes', 'space_id'],
    ['folders', 'owner_id'],
    ['spaces', 'owner_id'],
    ['space_users', 'space_id'],
    ['space_users', 'user_id'],
    ['space_open_sessions', 'device_id'],
    ['space_open_sessions', 'space_id'],
  ],
});

export const NOTES_APP_TABLES = [
  'folders',
  'notes',
  'spaces',
  'space_users',
  'space_open_sessions',
] as const;
