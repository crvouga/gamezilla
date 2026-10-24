import { battleshipGameShared } from '@libs/battleship-shared-ts/battleship-game';
import { chessGameShared } from '@libs/chess-sub-shared-ts/chess-game';
import { connectFourGameShared } from '@libs/connect-four-shared-ts/connect-four-game';
import {
  assertGameDefinitions,
  type GameRegistration,
} from '@libs/game-session-shared-ts/game-definition';
import {
  assertTurnGameDefinitions,
  isTurnGameDefinition,
  type TurnGameDefinition,
} from '@libs/game-session-shared-ts/turn-game-definition';
import { numberlinkGameShared } from '@libs/numberlink-shared-ts/numberlink-game';
import {
  quoridorGameShared,
  quoridorHillGameShared,
} from '@libs/quoridor-shared-ts/quoridor-game';
import { assertGameRegistry } from '@libs/spaces-shared-ts/load-game-plugins';
import { assertGameNamespaceOwner } from './game-namespace-owner';

/**
 * Every game the product offers, in the order the game choice shows them:
 * the one registry the server, the room host and the client compose. Add a
 * game by appending its `defineGame` or `defineTurnGame` definition; nothing
 * else in the platform names a game.
 */
export const GAME_DEFINITIONS = [
  chessGameShared,
  connectFourGameShared,
  battleshipGameShared,
  numberlinkGameShared,
  quoridorGameShared,
  quoridorHillGameShared,
] as const satisfies readonly GameRegistration[];

/** Only games offering a turn engine enter multiplayer catalogs and suites. */
export const TURN_GAME_DEFINITIONS: readonly TurnGameDefinition[] =
  GAME_DEFINITIONS.flatMap((game) =>
    isTurnGameDefinition(game) ? [game] : []
  );

assertGameRegistry(GAME_DEFINITIONS);
assertGameDefinitions('GAME_DEFINITIONS', GAME_DEFINITIONS);
assertTurnGameDefinitions('TURN_GAME_DEFINITIONS', TURN_GAME_DEFINITIONS);
assertGameNamespaceOwner(TURN_GAME_DEFINITIONS, chessGameShared);
