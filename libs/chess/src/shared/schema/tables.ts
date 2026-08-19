import { defineTable } from '@pkgs/db-schema';

export const chessPuzzles = defineTable({
  domain: 'chess',
  name: 'chess_puzzles',
  columns: {
    fen: 'text',
    moves: 'text',
    rating: 'integer',
    rating_deviation: 'integer',
    popularity: 'integer',
    nb_plays: 'integer',
    themes: 'json',
    game_url: 'text',
    opening_tags: 'json',
  },
  indexes: ['popularity', 'rating', ['rating', 'popularity']],
  deprecations: [['sync_pool', 'not needed anymore']],
});

export const chessPuzzleLoad = defineTable({
  domain: 'chess',
  name: 'chess_puzzle_load',
  columns: {
    source_etag: 'text',
    cursor: 'text',
    finished_at: 'timestamp',
  },
});

export const chessPuzzleProfiles = defineTable({
  domain: 'chess',
  name: 'chess_puzzle_profiles',
  columns: {
    owner_id: 'text',
    rating: 'integer',
    rating_deviation: 'integer',
    last_interaction_at: 'timestamp',
  },
  indexes: ['owner_id'],
});

export const chessPuzzleInteractions = defineTable({
  domain: 'chess',
  name: 'chess_puzzle_interactions',
  columns: {
    owner_id: 'text',
    puzzle_id: 'text',
    puzzle_rating: 'integer',
    kind: 'text',
    solve_idx: 'integer',
    uci: 'text',
    correct: 'boolean',
    rating_before: 'integer',
    rating_after: 'integer',
    at: 'timestamp',
  },
  indexes: ['at', 'owner_id', 'puzzle_id'],
});

export const CHESS_TABLES = [
  chessPuzzles,
  chessPuzzleLoad,
  chessPuzzleProfiles,
  chessPuzzleInteractions,
] as const;
