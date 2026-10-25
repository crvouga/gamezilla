import { battleshipGameShared } from '@libs/battleship-shared-ts/battleship-game';
import { chessGameShared } from '@libs/chess-sub-shared-ts/chess-game';
import { connectFourGameShared } from '@libs/connect-four-shared-ts/connect-four-game';
import {
  assertGameDefinitions,
  type GameRegistration,
  isGameRegistration,
  type RegistryGame,
} from '@libs/game-session-shared-ts/game-definition';
import { numberlinkGameShared } from '@libs/numberlink-shared-ts/numberlink-game';
import { pongGameShared } from '@libs/pong-shared-ts/pong-game';
import {
  quoridorGameShared,
  quoridorHillGameShared,
} from '@libs/quoridor-shared-ts/quoridor-game';
import { assertGameRegistry } from '@libs/spaces-shared-ts/load-game-plugins';
import {
  wordTiles3GameShared,
  wordTiles4GameShared,
  wordTilesGameShared,
} from '@libs/word-tiles-shared-ts/word-tiles-game';
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
  numberlinkGameShared,
  quoridorGameShared,
  quoridorHillGameShared,
  wordTilesGameShared,
  wordTiles3GameShared,
  wordTiles4GameShared,
  pongGameShared,
] as const satisfies readonly RegistryGame[];

/** Only games holding positions (turn rules or a simulation) enter catalogs and shared suites. */
export const REGISTERED_GAME_DEFINITIONS: readonly GameRegistration[] =
  GAME_DEFINITIONS.flatMap((game) => (isGameRegistration(game) ? [game] : []));

assertGameRegistry(GAME_DEFINITIONS);
assertGameDefinitions('GAME_DEFINITIONS', GAME_DEFINITIONS);
assertGameNamespaceOwner(REGISTERED_GAME_DEFINITIONS, chessGameShared);
