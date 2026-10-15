import { chessPuzzleGame } from '@libs/chess-puzzle-shared/chess-game';
import { chessNoticeText } from '@libs/chess-rules-shared/chess-notice-text';
import { chessRules } from '@libs/chess-rules-shared/chess-rules';
import { GAME_ROOM_CAPABILITY } from '@libs/game-session-shared/game-room-capability';
import type { GameDefinition } from '@libs/spaces-shared/game';
export const chessGameShared: GameDefinition = {
  ...chessPuzzleGame,
  turnGame: { rules: chessRules, controlPrefix: '', notice: chessNoticeText },
  roomCapabilities: [GAME_ROOM_CAPABILITY],
};
