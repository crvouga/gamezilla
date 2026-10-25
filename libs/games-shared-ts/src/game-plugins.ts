import { battleshipGameShared } from '@libs/battleship-shared-ts/battleship-game';
import { chessGameShared } from '@libs/chess-sub-shared-ts/chess-game';
import { connectFourGameShared } from '@libs/connect-four-shared-ts/connect-four-game';
import {
  type AnyGameRegistration,
  assertGameDefinitions,
  type GameRegistration,
  isGameRegistration,
} from '@libs/game-session-shared-ts/game-definition';
import { heartsGameShared } from '@libs/hearts-shared-ts/hearts-game';
import {
  lightCyclesDuelShared,
  lightCyclesQuadShared,
  lightCyclesTrioShared,
} from '@libs/light-cycles-shared-ts/light-cycles-game';
import { numberlinkGameShared } from '@libs/numberlink-shared-ts/numberlink-game';
import { pongGameShared } from '@libs/pong-shared-ts/pong-game';
import {
  quoridorGameShared,
  quoridorHillGameShared,
} from '@libs/quoridor-shared-ts/quoridor-game';
import { sokobanGameShared } from '@libs/sokoban-shared-ts/sokoban-game';
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
  numberlinkGameShared,
  sokobanGameShared,
  quoridorGameShared,
  quoridorHillGameShared,
  heartsGameShared,
  pongGameShared,
  lightCyclesDuelShared,
  lightCyclesTrioShared,
  lightCyclesQuadShared,
] as const satisfies readonly AnyGameRegistration[];

/** Games with position rules — turns, a simulation or both — enter session catalogs and suites. */
export const PLAYABLE_GAME_DEFINITIONS: readonly GameRegistration[] =
  GAME_DEFINITIONS.flatMap((game) => (isGameRegistration(game) ? [game] : []));

assertGameRegistry(GAME_DEFINITIONS);
assertGameDefinitions('GAME_DEFINITIONS', GAME_DEFINITIONS);
assertGameNamespaceOwner(PLAYABLE_GAME_DEFINITIONS, chessGameShared);
