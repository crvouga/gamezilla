import { battleshipGameShared } from '@libs/battleship-shared-ts/battleship-game';
import { chessGameShared } from '@libs/chess-sub-shared-ts/chess-game';
import { connectFourGameShared } from '@libs/connect-four-shared-ts/connect-four-game';
import type { GameRegistration } from '@libs/game-session-shared-ts/game-definition';
import { assertGameDefinitions } from '@libs/game-session-shared-ts/game-definition';
import { pongGameShared } from '@libs/pong-shared-ts/pong-game';
import { assertGameRegistry } from '@libs/spaces-shared-ts/load-game-plugins';
import { assertGameNamespaceOwner } from './game-namespace-owner';

/**
 * Every game the product offers, in the order the game choice shows them:
 * the one registry the server, the room host and the client compose. Add a
 * game by appending its `defineGame` definition; nothing else in the
 * platform names a game.
 */
export const GAME_DEFINITIONS = [
  chessGameShared,
  connectFourGameShared,
  battleshipGameShared,
  pongGameShared,
] as const satisfies readonly GameRegistration[];

assertGameRegistry(GAME_DEFINITIONS);
assertGameDefinitions('GAME_DEFINITIONS', GAME_DEFINITIONS);
assertGameNamespaceOwner(GAME_DEFINITIONS, chessGameShared);
