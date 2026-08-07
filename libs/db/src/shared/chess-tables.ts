/**
 * Full catalog on Postgres; sync clients only receive rows with
 * `sync_pool = true` (~4k). Must match the sync-stream source table name
 * exactly — `AS` aliases do not remap apply targets here.
 */
export const CHESS_PUZZLES_TABLE = 'chess_puzzles' as const;
export const CHESS_PUZZLE_LOAD_TABLE = 'chess_puzzle_load' as const;
export const CHESS_PUZZLE_PROFILES_TABLE = 'chess_puzzle_profiles' as const;
export const CHESS_PUZZLE_INTERACTIONS_TABLE =
  'chess_puzzle_interactions' as const;

export const CHESS_PUZZLES_LOCAL_DDL = `
CREATE TABLE IF NOT EXISTS "chess_puzzles" (
  "id" TEXT PRIMARY KEY,
  "fen" TEXT,
  "moves" TEXT,
  "rating" INTEGER,
  "rating_deviation" INTEGER,
  "popularity" INTEGER,
  "nb_plays" INTEGER,
  "themes" TEXT,
  "game_url" TEXT,
  "opening_tags" TEXT
)
`;

export const CHESS_PUZZLE_LOAD_LOCAL_DDL = `
CREATE TABLE IF NOT EXISTS "chess_puzzle_load" (
  "id" TEXT PRIMARY KEY,
  "source_etag" TEXT,
  "cursor" TEXT,
  "finished_at" TEXT
)
`;

export const CHESS_PUZZLE_PROFILES_LOCAL_DDL = `
CREATE TABLE IF NOT EXISTS "chess_puzzle_profiles" (
  "id" TEXT PRIMARY KEY,
  "owner_id" TEXT,
  "rating" INTEGER,
  "rating_deviation" INTEGER,
  "last_interaction_at" TEXT
)
`;

export const CHESS_PUZZLE_INTERACTIONS_LOCAL_DDL = `
CREATE TABLE IF NOT EXISTS "chess_puzzle_interactions" (
  "id" TEXT PRIMARY KEY,
  "owner_id" TEXT,
  "puzzle_id" TEXT,
  "puzzle_rating" INTEGER,
  "kind" TEXT,
  "solve_idx" INTEGER,
  "uci" TEXT,
  "correct" INTEGER,
  "rating_before" INTEGER,
  "rating_after" INTEGER,
  "at" TEXT
)
`;

export const ALL_CHESS_SYNC_TABLES = [
  CHESS_PUZZLES_TABLE,
  CHESS_PUZZLE_LOAD_TABLE,
  CHESS_PUZZLE_PROFILES_TABLE,
  CHESS_PUZZLE_INTERACTIONS_TABLE,
] as const;

export const ALL_CHESS_LOCAL_DDL = [
  CHESS_PUZZLES_LOCAL_DDL,
  CHESS_PUZZLE_LOAD_LOCAL_DDL,
  CHESS_PUZZLE_PROFILES_LOCAL_DDL,
  CHESS_PUZZLE_INTERACTIONS_LOCAL_DDL,
] as const;
