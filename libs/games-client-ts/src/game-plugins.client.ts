import { battleshipGameClient } from '@libs/battleship-client-ts/battleship-game-client';
import { chessGameClient } from '@libs/chess-root-client-ts/chess-game-client';
import { connectFourGameClient } from '@libs/connect-four-client-ts/connect-four-game-client';
import type { GameClientRegistration } from '@libs/game-menu-client-ts/game-client';
import { assertGameClientDefinitions } from '@libs/game-menu-client-ts/game-client';
import { assertGameModes } from '@libs/game-menu-client-ts/game-frame-contract';
import { GAME_DEFINITIONS } from '@libs/games-shared-ts/game-plugins';
import { heartsGameClient } from '@libs/hearts-client-ts/hearts-game-client';
import {
  lightCyclesDuelClient,
  lightCyclesQuadClient,
  lightCyclesTrioClient,
} from '@libs/light-cycles-client-ts/light-cycles-game-client';
import { numberlinkGameClient } from '@libs/numberlink-client-ts/numberlink-game-client';
import { pongGameClient } from '@libs/pong-client-ts/pong-game-client';
import {
  quoridorGameClient,
  quoridorHillGameClient,
} from '@libs/quoridor-client-ts/quoridor-game-client';
import { sokobanGameClient } from '@libs/sokoban-client-ts/sokoban-game-client';
import {
  assertGameRegistry,
  assertMatchingGameIds,
} from '@libs/spaces-shared-ts/load-game-plugins';
import {
  wordTiles3GameClient,
  wordTiles4GameClient,
  wordTilesGameClient,
} from '@libs/word-tiles-client-ts/word-tiles-game-client';

/**
 * Client UI definitions for each game in {@link GAME_DEFINITIONS}.
 * Not imported by `apps/server-ts`.
 */
export const GAME_CLIENT_DEFINITIONS = [
  chessGameClient,
  connectFourGameClient,
  battleshipGameClient,
  numberlinkGameClient,
  sokobanGameClient,
  quoridorGameClient,
  quoridorHillGameClient,
  wordTilesGameClient,
  wordTiles3GameClient,
  wordTiles4GameClient,
  heartsGameClient,
  pongGameClient,
  lightCyclesDuelClient,
  lightCyclesTrioClient,
  lightCyclesQuadClient,
] as const satisfies readonly GameClientRegistration[];

assertGameRegistry(GAME_CLIENT_DEFINITIONS);
assertGameClientDefinitions('GAME_CLIENT_DEFINITIONS', GAME_CLIENT_DEFINITIONS);
assertGameModes('GAME_CLIENT_DEFINITIONS', GAME_CLIENT_DEFINITIONS);
assertMatchingGameIds(GAME_DEFINITIONS, GAME_CLIENT_DEFINITIONS);
