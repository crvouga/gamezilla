import { chessPuzzleGame } from '@libs/chess-puzzle-shared/chess-game';
import { chessNoticeText } from '@libs/chess-rules-shared/chess-notice-text';
import { chessRules } from '@libs/chess-rules-shared/chess-rules';
import { GAME_ROOM_CAPABILITY } from '@libs/game-session-shared/game-room-capability';
import type { GameDefinition } from '@libs/spaces-shared/game';
import type { RegisteredTurnGame } from '@pkgs/turn-game-shared/game-rules';
import { GAME_CAPABILITIES } from '@pkgs/turn-game-shared/game-rules';
import { chessAutomation } from './chess-automation';

/**
 * Chess as a turn game. Its clock namespace is the unprefixed one, the
 * established identity of every stored chess search, rating and game.
 */
export const chessTurnGame: RegisteredTurnGame = {
  rules: chessRules,
  controlPrefix: '',
  notice: chessNoticeText,
  capabilities: GAME_CAPABILITIES,
};

export const chessGameShared = {
  ...chessPuzzleGame,
  automation: chessAutomation,
  turnGame: chessTurnGame,
  roomCapabilities: [GAME_ROOM_CAPABILITY],
} satisfies GameDefinition;
