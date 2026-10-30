import { chessPuzzles } from '@libs/chess-puzzle-shared-ts/chess-puzzles';
import { chessNoticeText } from '@libs/chess-rules-shared-ts/chess-notice-text';
import {
  chessBots,
  chessGameRecord,
  chessRules,
} from '@libs/chess-rules-shared-ts/chess-rules';
import { defineGame } from '@libs/game-session-shared-ts/game-definition';
import { createTurnGames } from '@pkgs/turn-game-shared-ts/game-rules';
import { chessAutomation } from './chess-automation';

/**
 * Chess offers every shared capability, puzzles included. Its clock and
 * puzzle namespaces are the unprefixed one, the established identity of
 * every stored chess search, rating, game and puzzle.
 */
export const chessGameShared = defineGame({
  rules: chessRules,
  unprefixedNamespace: true,
  capabilities: {
    'custom-games': { bots: chessBots },
    matchmaking: {
      clockChoices: true as const,
      namespace: '',
      notice: chessNoticeText,
    },
    history: { record: chessGameRecord },
    puzzles: chessPuzzles,
  },
  turnAutomation: chessAutomation,
});

export const chessTurnGame = chessGameShared.turnGame;

/** Chess alone, for its own suites and fixtures: never another game's rules. */
export const CHESS_TURN_GAMES = createTurnGames([chessTurnGame]);
