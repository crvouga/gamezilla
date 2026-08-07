import { defineSchema } from '@pkgs/db-schema';

/**
 * Tiny notes app domain schema for black-box sync-engine scenarios.
 * Managed columns (`_id`, `_created_at`, `_updated_at`, `_deleted_at`) are
 * implicit via `@pkgs/db-schema`.
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
      title: 'text',
      body: 'text',
      owner_id: 'text',
    },
  },
  uniqueIndexes: [
    ['folders', 'id'],
    ['notes', 'id'],
  ],
  indexes: [
    ['notes', 'folder_id'],
    ['notes', 'owner_id'],
    ['folders', 'owner_id'],
  ],
});

export const NOTES_APP_TABLES = ['folders', 'notes'] as const;
