import { defineTable } from '@pkgs/db-schema-root-shared-ts/define-table';
import { ATTEMPT_TABLES } from './attempt-tables';

export const puzzleContentDocuments = defineTable({
  domain: 'puzzle_content',
  name: 'puzzle_content_documents',
  columns: {
    owner_id: 'text',
    game_id: 'text',
    kind: 'text',
    working_draft_id: 'text',
    published_revision_id: 'text',
    publication_count: 'integer',
    status: 'text',
  },
  indexes: ['owner_id', ['game_id', 'status']],
});

/** Written only when publication or withdrawal changes public availability. */
export const puzzleContentPublications = defineTable({
  domain: 'puzzle_content',
  name: 'puzzle_content_publications',
  columns: {
    owner_id: 'text',
    game_id: 'text',
    kind: 'text',
    published_revision_id: 'text',
    publication_count: 'integer',
    status: 'text',
  },
  indexes: ['owner_id', ['game_id', 'status']],
});

/** Saved working copies form branches rather than overwriting a stale device's work. */
export const puzzleContentDrafts = defineTable({
  domain: 'puzzle_content',
  name: 'puzzle_content_drafts',
  columns: {
    document_id: 'text',
    owner_id: 'text',
    parent_id: 'text',
    title: 'text',
    description: 'text',
    difficulty: 'text',
    definition: 'text',
    conflicted: 'boolean',
    validation_status: 'text',
    validation_issues: 'text',
    /** Encoded replayable evidence: the rules version and accepted actions. */
    validation_solution: 'text',
  },
  indexes: ['owner_id', 'document_id'],
});

/** Its id is the source draft's id: publishing that draft again is a no-op. */
export const puzzleContentRevisions = defineTable({
  domain: 'puzzle_content',
  name: 'puzzle_content_revisions',
  columns: {
    document_id: 'text',
    owner_id: 'text',
    game_id: 'text',
    kind: 'text',
    edition: 'integer',
    title: 'text',
    description: 'text',
    difficulty: 'text',
    definition: 'text',
    /** The game's rules version this edition is played under, and no other. */
    rules_version: { type: 'integer', backfill: { sql: '1' } },
  },
  // Replica tombstones can retain a refused tentative edition with this number.
  // The publication's document compare-and-set allocates authoritative numbers.
  indexes: ['owner_id', 'document_id', ['document_id', 'edition']],
});

/** Public pack references are materialized once when their edition is published. */
export const puzzleContentPackItems = defineTable({
  domain: 'puzzle_content',
  name: 'puzzle_content_pack_items',
  columns: {
    owner_id: 'text',
    pack_revision_id: 'text',
    puzzle_id: 'text',
    puzzle_revision_id: 'text',
    position: 'integer',
  },
  indexes: ['pack_revision_id', 'puzzle_revision_id'],
  uniqueIndexes: [
    ['pack_revision_id', 'position'],
    ['pack_revision_id', 'puzzle_id'],
  ],
});

export const CONTENT_TABLES = [
  ...ATTEMPT_TABLES,
  puzzleContentDocuments,
  puzzleContentPublications,
  puzzleContentDrafts,
  puzzleContentRevisions,
  puzzleContentPackItems,
] as const;
