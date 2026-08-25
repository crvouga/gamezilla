import { defineTable, registerTables } from '@pkgs/db-schema';

/**
 * Tiny notes app domain schema for black-box sync-engine scenarios.
 * Managed columns (`id`, `created_at`, `updated_at`, `deleted_at`) are
 * implicit via `@pkgs/db-schema`.
 *
 * `spaces` / `spaces_users` mirror product membership table names so
 * `attachPush` table-change hooks schedule topic sync.
 */
export const notesAppSchema = registerTables([
  defineTable({
    domain: 'folders',
    name: 'folders',
    columns: { title: 'text', owner_id: 'text' },
    indexes: ['owner_id'],
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
    indexes: ['folder_id', 'owner_id', 'space_id'],
  }),
  defineTable({
    domain: 'spaces',
    name: 'spaces',
    columns: { title: 'text', owner_id: 'text' },
    indexes: ['owner_id'],
  }),
  defineTable({
    domain: 'spaces',
    name: 'spaces_users',
    columns: { space_id: 'text', user_id: 'text' },
    indexes: ['space_id', 'user_id'],
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
    indexes: ['device_id', 'space_id'],
    uniqueIndexes: [['device_id', 'space_id']],
  }),
  defineTable({
    domain: 'profile',
    name: 'profile',
    columns: { username: 'text', username_norm: 'text' },
    indexes: ['username_norm'],
  }),
  defineTable({
    domain: 'friends',
    name: 'friends_friendships',
    columns: { user_low: 'text', user_high: 'text' },
    indexes: ['user_low', 'user_high'],
    uniqueIndexes: [['user_low', 'user_high']],
  }),
]);

export const NOTES_APP_TABLES = [
  'folders',
  'notes',
  'spaces',
  'spaces_users',
  'spaces_open_sessions',
  'profile',
  'friends_friendships',
] as const;
