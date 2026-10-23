import { battleshipGameShared } from '@libs/battleship-shared-ts/battleship-game';
import { chessGameShared } from '@libs/chess-sub-shared-ts/chess-game';
import { connectFourGameShared } from '@libs/connect-four-shared-ts/connect-four-game';
import type { TurnGameDefinition } from '@libs/game-session-shared-ts/turn-game-definition';
import { assertTurnGameDefinitions } from '@libs/game-session-shared-ts/turn-game-definition';
import {
  quoridorGameShared,
  quoridorHillGameShared,
} from '@libs/quoridor-shared-ts/quoridor-game';
import { assertGameRegistry } from '@libs/spaces-shared-ts/load-game-plugins';
import { assertGameNamespaceOwner } from './game-namespace-owner';

/**
 * Every game the product offers, in the order the game choice shows them:
 * the one registry the server, the room host and the client compose. Add a
 * game by appending its `defineTurnGame` definition; nothing else in the
 * platform names a game.
 */
export const GAME_DEFINITIONS = [
  chessGameShared,
  connectFourGameShared,
  battleshipGameShared,
  quoridorGameShared,
  quoridorHillGameShared,
] as const satisfies readonly TurnGameDefinition[];

assertGameRegistry(GAME_DEFINITIONS);
assertTurnGameDefinitions('GAME_DEFINITIONS', GAME_DEFINITIONS);
assertGameNamespaceOwner(GAME_DEFINITIONS, chessGameShared);
