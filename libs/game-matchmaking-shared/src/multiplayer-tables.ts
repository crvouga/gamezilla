import { defineTable } from '@pkgs/db-schema-root-shared/define-table';
import { GAME_PLATFORM_NAMESPACE } from './durable-names';

export const multiplayerGames = defineTable({
  domain: GAME_PLATFORM_NAMESPACE,
  name: 'chess_multiplayer_games',
  columns: {
    match_id: 'text',
    white_id: 'text',
    black_id: 'text',
    fen: 'text',
    pgn: 'text',
    revision: 'integer',
    turn: 'text',
    outcome: 'text',
    reason: 'text',
    time_control: 'text',
    white_ms: 'integer',
    black_ms: 'integer',
    clock_at_ms: 'integer',
    paused_at_ms: 'integer',
    draw_offer_by: 'text',
    rematch_offer_by: 'text',
    rematch_of: 'text',
    white_rating: 'text',
    black_rating: 'text',
    white_rating_diff: 'integer',
    black_rating_diff: 'integer',
  },
  uniqueIndexes: ['match_id'],
  indexes: ['white_id', 'black_id'],
});

/** One person's multiplayer rating at one speed (Glicko-2, integral). */
export const multiplayerRatings = defineTable({
  domain: GAME_PLATFORM_NAMESPACE,
  name: 'chess_multiplayer_ratings',
  columns: {
    owner_id: 'text',
    speed: 'text',
    rating: 'integer',
    rating_deviation: 'integer',
    volatility_micros: 'integer',
    games: 'integer',
  },
  uniqueIndexes: [['owner_id', 'speed']],
});

export const multiplayerPlayers = defineTable({
  domain: GAME_PLATFORM_NAMESPACE,
  name: 'chess_multiplayer_players',
  columns: { owner_id: 'text', game_id: 'text' },
  uniqueIndexes: ['owner_id'],
});

/** The actor's synchronized projection of the reusable package's accepted search. */
export const opponentSearches = defineTable({
  domain: GAME_PLATFORM_NAMESPACE,
  name: 'chess_opponent_searches',
  columns: {
    owner_id: 'text',
    search_id: 'text',
    standing: 'text',
    match_id: 'text',
    joined_at_ms: 'integer',
    observed_at_ms: 'integer',
    formulas: 'json',
    time_control: 'text',
  },
  uniqueIndexes: ['owner_id'],
});

export const multiplayerCommands = defineTable({
  domain: GAME_PLATFORM_NAMESPACE,
  name: 'chess_multiplayer_commands',
  columns: {
    owner_id: 'text',
    request_id: 'text',
    game_id: 'text',
    kind: 'text',
  },
  uniqueIndexes: [['owner_id', 'request_id']],
});

export const MULTIPLAYER_TABLES = [
  multiplayerGames,
  multiplayerPlayers,
  opponentSearches,
  multiplayerCommands,
  multiplayerRatings,
] as const;
