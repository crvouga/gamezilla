import { defineTable } from '@pkgs/db-schema-root-shared-ts/define-table';

export const puzzleContentAttempts = defineTable({
  domain: 'puzzle_content',
  name: 'puzzle_content_attempts',
  columns: {
    owner_id: 'text',
    puzzle_id: 'text',
    source_id: 'text',
    game_id: 'text',
    mode: 'text',
    pack_revision_id: 'text',
    current_position_id: 'text',
    activity_order: { type: 'integer', backfill: { sql: '0' } },
  },
  indexes: [
    'owner_id',
    ['owner_id', 'pack_revision_id'],
    ['owner_id', 'activity_order'],
  ],
});

export const puzzleContentPositions = defineTable({
  domain: 'puzzle_content',
  name: 'puzzle_content_positions',
  columns: {
    owner_id: 'text',
    attempt_id: 'text',
    parent_id: 'text',
    history: 'text',
    conflicted: 'boolean',
  },
  indexes: ['owner_id', 'attempt_id'],
});

/** One durable completion per person and puzzle edition, regardless of restarts. */
export const puzzleContentCompletions = defineTable({
  domain: 'puzzle_content',
  name: 'puzzle_content_completions',
  columns: {
    owner_id: 'text',
    puzzle_id: 'text',
    puzzle_revision_id: 'text',
    attempt_id: 'text',
    position_id: 'text',
    statistics: 'text',
  },
  indexes: ['owner_id', 'puzzle_revision_id'],
  uniqueIndexes: [['owner_id', 'puzzle_revision_id']],
});

export const ATTEMPT_TABLES = [
  puzzleContentAttempts,
  puzzleContentPositions,
  puzzleContentCompletions,
] as const;
