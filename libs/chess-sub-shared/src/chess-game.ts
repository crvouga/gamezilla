import { chessPuzzleRoom } from '@libs/chess-puzzle-shared/chess-game';
import { chessNoticeText } from '@libs/chess-rules-shared/chess-notice-text';
import {
  chessBots,
  chessGameRecord,
  chessRules,
} from '@libs/chess-rules-shared/chess-rules';
import { defineTurnGame } from '@libs/game-session-shared/turn-game-definition';
import { createTurnGames } from '@pkgs/turn-game-shared/game-rules';
import { chessAutomation } from './chess-automation';

/**
 * Chess offers every shared capability, and its puzzles as its own screens.
 * Its clock namespace is the unprefixed one, the established identity of
 * every stored chess search, rating and game.
 */
export const chessGameShared = defineTurnGame({
  rules: chessRules,
  capabilities: {
    'custom-games': { bots: chessBots },
    matchmaking: { clockNamespace: '', notice: chessNoticeText },
    history: { record: chessGameRecord },
  },
  automation: chessAutomation,
  own: chessPuzzleRoom,
});

export const chessTurnGame = chessGameShared.turnGame;

/** Chess alone, for its own suites and fixtures: never another game's rules. */
export const CHESS_TURN_GAMES = createTurnGames([chessTurnGame]);
