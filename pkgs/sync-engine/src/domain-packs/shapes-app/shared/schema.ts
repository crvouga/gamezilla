import { defineSchema } from '@pkgs/db-schema';

/**
 * Tiny ordered-shapes domain for the sync-engine sim lab.
 * Managed columns (`_id`, `_created_at`, `_updated_at`, `_deleted_at`) are
 * implicit via `@pkgs/db-schema`.
 */
export const shapesAppSchema = defineSchema({
  tables: {
    shapes: {
      id: 'text',
      kind: 'text',
      sort_key: 'integer',
      owner_id: 'text',
    },
  },
  uniqueIndexes: [['shapes', 'id']],
  indexes: [
    ['shapes', 'sort_key'],
    ['shapes', 'owner_id'],
  ],
});

export const SHAPES_APP_TABLES = ['shapes'] as const;

export const SHAPE_KINDS = ['circle', 'square', 'triangle'] as const;
export type ShapeKind = (typeof SHAPE_KINDS)[number];
