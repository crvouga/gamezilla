import { defineTable } from '@pkgs/sync-engine/shared/table-definition';

export const ChessPuzzleCol = {
  id: 'id',
  fen: 'fen',
  moves: 'moves',
  rating: 'rating',
  ratingDeviation: 'rating_deviation',
  popularity: 'popularity',
  nbPlays: 'nb_plays',
  themes: 'themes',
  gameUrl: 'game_url',
  openingTags: 'opening_tags',
} as const;

export const ChessPuzzleLoadCol = {
  id: 'id',
  sourceEtag: 'source_etag',
  cursor: 'cursor',
  finishedAt: 'finished_at',
} as const;

export const ChessPuzzleProfileCol = {
  id: 'id',
  ownerId: 'owner_id',
  rating: 'rating',
  ratingDeviation: 'rating_deviation',
  lastInteractionAt: 'last_interaction_at',
} as const;

export const ChessPuzzleInteractionCol = {
  id: 'id',
  ownerId: 'owner_id',
  puzzleId: 'puzzle_id',
  puzzleRating: 'puzzle_rating',
  kind: 'kind',
  solveIdx: 'solve_idx',
  uci: 'uci',
  correct: 'correct',
  ratingBefore: 'rating_before',
  ratingAfter: 'rating_after',
  at: 'at',
} as const;

/**
 * Full catalog on Postgres; PowerSync clients only receive rows with
 * `sync_pool = true` (~4k). Must match the sync-stream source table name
 * exactly — `AS` aliases do not remap apply targets here.
 */
export const CHESS_PUZZLES_TABLE = defineTable({
  tableName: 'chess_puzzles',
  columns: [
    { name: 'id', type: 'text', primaryKey: true },
    { name: 'fen', type: 'text' },
    { name: 'moves', type: 'text' },
    { name: 'rating', type: 'integer' },
    { name: 'rating_deviation', type: 'integer' },
    { name: 'popularity', type: 'integer' },
    { name: 'nb_plays', type: 'integer' },
    { name: 'themes', type: 'text' },
    { name: 'game_url', type: 'text' },
    { name: 'opening_tags', type: 'text' },
  ],
});

export const CHESS_PUZZLE_LOAD_TABLE = defineTable({
  tableName: 'chess_puzzle_load',
  columns: [
    { name: 'id', type: 'text', primaryKey: true },
    { name: 'source_etag', type: 'text' },
    { name: 'cursor', type: 'text' },
    { name: 'finished_at', type: 'text' },
  ],
});

export const CHESS_PUZZLE_PROFILES_TABLE = defineTable({
  tableName: 'chess_puzzle_profiles',
  columns: [
    { name: 'id', type: 'text', primaryKey: true },
    { name: 'owner_id', type: 'text' },
    { name: 'rating', type: 'integer' },
    { name: 'rating_deviation', type: 'integer' },
    { name: 'last_interaction_at', type: 'text' },
  ],
});

export const CHESS_PUZZLE_INTERACTIONS_TABLE = defineTable({
  tableName: 'chess_puzzle_interactions',
  columns: [
    { name: 'id', type: 'text', primaryKey: true },
    { name: 'owner_id', type: 'text' },
    { name: 'puzzle_id', type: 'text' },
    { name: 'puzzle_rating', type: 'integer' },
    { name: 'kind', type: 'text' },
    { name: 'solve_idx', type: 'integer' },
    { name: 'uci', type: 'text' },
    { name: 'correct', type: 'integer' },
    { name: 'rating_before', type: 'integer' },
    { name: 'rating_after', type: 'integer' },
    { name: 'at', type: 'text' },
  ],
});

export const ALL_CHESS_SYNC_TABLES = [
  CHESS_PUZZLES_TABLE,
  CHESS_PUZZLE_LOAD_TABLE,
  CHESS_PUZZLE_PROFILES_TABLE,
  CHESS_PUZZLE_INTERACTIONS_TABLE,
] as const;
