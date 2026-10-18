import { chessGameShared } from '@libs/chess-sub-shared/chess-game';
import { connectFourGameShared } from '@libs/connect-four-shared/connect-four-game';
import type { TurnGameDefinition } from '@libs/game-session-shared/turn-game-definition';
import { assertTurnGameDefinitions } from '@libs/game-session-shared/turn-game-definition';
import { assertGameRegistry } from '@libs/spaces-shared/load-game-plugins';

/**
 * Every game the product offers, in the order the game choice shows them:
 * the one registry the server, the room host and the client compose. Add a
 * game by appending its `defineTurnGame` definition; nothing else in the
 * platform names a game.
 */
export const GAME_DEFINITIONS = [
  chessGameShared,
  connectFourGameShared,
] as const satisfies readonly TurnGameDefinition[];

assertGameRegistry(GAME_DEFINITIONS);
assertTurnGameDefinitions('GAME_DEFINITIONS', GAME_DEFINITIONS);
