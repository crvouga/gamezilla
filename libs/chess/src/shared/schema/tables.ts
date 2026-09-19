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
    /** Hash of FEN fields 1–4 + the line; null on rows seeded before §23. */
    position_key: 'text',
  },
  // Pool / band reads filter on rating and order by popularity. Themes and
  // opening tags are JSON arrays filtered on the client only (no server
  // query reads them in Phase 1), so they carry no index.
  indexes: ['rating', 'popularity'],
  // §23 dedupe: one row per position + solution, whatever its id.
  uniqueIndexes: ['position_key'],
  retiredColumns: [
    { name: 'sync_pool', type: 'boolean', note: 'not needed anymore' },
  ],
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
    at: 'timestamp',
  },
  retiredColumns: [
    {
      name: 'rating_before',
      type: 'integer',
      note: 'Elo is projected from interaction history',
    },
    {
      name: 'rating_after',
      type: 'integer',
      note: 'Elo is projected from interaction history',
    },
  ],
});

export const CHESS_TABLES = [
  chessPuzzles,
  chessPuzzleLoad,
  chessPuzzleProfiles,
  chessPuzzleInteractions,
] as const;
