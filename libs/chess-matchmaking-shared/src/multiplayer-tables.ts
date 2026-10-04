import { defineTable } from '@pkgs/db-schema-shared/define-table';

export const chessMultiplayerGames = defineTable({
  domain: 'chess',
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
  },
  uniqueIndexes: ['match_id'],
  indexes: ['white_id', 'black_id'],
});

export const chessMultiplayerPlayers = defineTable({
  domain: 'chess',
  name: 'chess_multiplayer_players',
  columns: { owner_id: 'text', game_id: 'text' },
  uniqueIndexes: ['owner_id'],
});

/** The actor's synchronized projection of the reusable package's accepted search. */
export const chessOpponentSearches = defineTable({
  domain: 'chess',
  name: 'chess_opponent_searches',
  columns: {
    owner_id: 'text',
    search_id: 'text',
    standing: 'text',
    match_id: 'text',
    joined_at_ms: 'integer',
    observed_at_ms: 'integer',
    formulas: 'json',
  },
  uniqueIndexes: ['owner_id'],
});

export const chessMultiplayerCommands = defineTable({
  domain: 'chess',
  name: 'chess_multiplayer_commands',
  columns: {
    owner_id: 'text',
    request_id: 'text',
    game_id: 'text',
    kind: 'text',
  },
  uniqueIndexes: [['owner_id', 'request_id']],
});

export const CHESS_MULTIPLAYER_TABLES = [
  chessMultiplayerGames,
  chessMultiplayerPlayers,
  chessOpponentSearches,
  chessMultiplayerCommands,
] as const;
