import { defineTable } from '@pkgs/db-schema-root-shared-ts/define-table';

/** Progress of loading the Lichess puzzle file: chess's own import pipeline. */
export const chessPuzzleLoad = defineTable({
  domain: 'chess',
  name: 'chess_puzzle_load',
  columns: {
    source_etag: 'text',
    cursor: 'text',
    finished_at: 'timestamp',
    status: 'text',
    requested_by: 'text',
    object_key: 'text',
    processed_rows: 'integer',
    inserted_rows: 'integer',
    failed_rows: 'integer',
    updated_rows: 'integer',
    duplicate_rows: 'integer',
    total_chunks: 'integer',
    completed_chunks: 'integer',
    pool_rows: 'integer',
    error: 'text',
  },
});
