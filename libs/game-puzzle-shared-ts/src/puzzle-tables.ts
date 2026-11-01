import { GAME_PLATFORM_NAMESPACE } from '@libs/game-matchmaking-shared-ts/durable-names';
import { defineTable } from '@pkgs/db-schema-root-shared-ts/define-table';
import { CONTENT_TABLES } from './content-tables';

export const chessPuzzles = defineTable({
  domain: GAME_PLATFORM_NAMESPACE,
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

export const chessPuzzleProfiles = defineTable({
  domain: GAME_PLATFORM_NAMESPACE,
  name: 'chess_puzzle_profiles',
  columns: {
    owner_id: 'text',
    // §8 Glicko-2 state. Rating and deviation are rounded and volatility is
    // held in micros so nothing float ever reaches the wire (README.md).
    rating: 'integer',
    rating_deviation: 'integer',
    volatility_micros: 'integer',
    last_interaction_at: 'timestamp',
  },
});

/**
 * §8 rating ledger: at most one row per (owner, puzzle), keyed by
 * `<ownerId>|<puzzleId>`. The primary key enforces "repeat attempts never
 * affect rating" for replays, duplicates and out-of-order uploads alike.
 */
export const chessPuzzleRatingEvents = defineTable({
  domain: GAME_PLATFORM_NAMESPACE,
  name: 'chess_puzzle_rating_events',
  columns: {
    owner_id: 'text',
    puzzle_id: 'text',
    puzzle_rating: 'integer',
    outcome: 'text',
    score_permille: 'integer',
    rating_before: 'integer',
    rating_after: 'integer',
    rating_deviation_before: 'integer',
    rating_deviation_after: 'integer',
    volatility_micros_after: 'integer',
    at: 'timestamp',
  },
  indexes: ['owner_id'],
});

export const chessPuzzleInteractions = defineTable({
  domain: GAME_PLATFORM_NAMESPACE,
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
    activity_order: { type: 'integer', backfill: { sql: '0' } },
  },
  retiredColumns: [
    {
      name: 'rating_before',
      type: 'integer',
      note: 'per-attempt rating lives in chess_puzzle_rating_events',
    },
    {
      name: 'rating_after',
      type: 'integer',
      note: 'per-attempt rating lives in chess_puzzle_rating_events',
    },
  ],
});

/**
 * An account's puzzle feed choices, one row per owner keyed by the owner id,
 * so they survive a closed app and follow the account to its other devices.
 * `config` is the canonical JSON text of a `PuzzleFeedConfig`.
 */
export const chessPuzzleFeedSettings = defineTable({
  domain: GAME_PLATFORM_NAMESPACE,
  name: 'chess_puzzle_feed_settings',
  columns: {
    owner_id: 'text',
    config: 'text',
  },
});

export const PUZZLE_TABLES = [
  ...CONTENT_TABLES,
  chessPuzzles,
  chessPuzzleProfiles,
  chessPuzzleFeedSettings,
  chessPuzzleRatingEvents,
  chessPuzzleInteractions,
] as const;

/**
 * The puzzle stores as the framework reads them: one shared, namespace-
 * partitioned table per concern. Framework code names a store through this
 * binding, never by its physical table, so a game or a rename touches only
 * this file.
 */
export const puzzleStores = {
  ratingEvents: chessPuzzleRatingEvents.name,
} as const;
