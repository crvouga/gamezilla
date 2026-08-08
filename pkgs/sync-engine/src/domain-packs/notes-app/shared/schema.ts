import { defineSchema } from '@pkgs/db-schema';

/**
 * Tiny notes app domain schema for black-box sync-engine scenarios.
 * Managed columns (`_id`, `_created_at`, `_updated_at`, `_deleted_at`) are
 * implicit via `@pkgs/db-schema`.
 *
 * `spaces` / `space_users` mirror product membership table names so
 * `attachPush` table-change hooks schedule topic sync.
 */
export const notesAppSchema = defineSchema({
  tables: {
    folders: {
      id: 'text',
      title: 'text',
      owner_id: 'text',
    },
    notes: {
      id: 'text',
      folder_id: 'text',
      space_id: 'text',
      title: 'text',
      body: 'text',
      owner_id: 'text',
    },
    spaces: {
      id: 'text',
      title: 'text',
      owner_id: 'text',
    },
    space_users: {
      id: 'text',
      space_id: 'text',
      user_id: 'text',
    },
  },
  uniqueIndexes: [
    ['folders', 'id'],
    ['notes', 'id'],
    ['spaces', 'id'],
    ['space_users', 'id'],
    ['space_users', 'space_id', 'user_id'],
  ],
  indexes: [
    ['notes', 'folder_id'],
    ['notes', 'owner_id'],
    ['notes', 'space_id'],
    ['folders', 'owner_id'],
    ['spaces', 'owner_id'],
    ['space_users', 'space_id'],
    ['space_users', 'user_id'],
  ],
});

export const NOTES_APP_TABLES = [
  'folders',
  'notes',
  'spaces',
  'space_users',
] as const;
