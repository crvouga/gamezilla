import { chessGameShared } from '@libs/chess-sub-shared/chess-game';
import { connectFourGameShared } from '@libs/connect-four-shared/connect-four-game';
import type { GameDefinition } from '@libs/spaces-shared/game';
import { assertGameRegistry } from '@libs/spaces-shared/load-game-plugins';

/**
 * Authoritative shared game definitions for server (`apps/server`) and client.
 * Add a workspace dep on the game lib and append its `*GameShared` export here.
 */
export const GAME_DEFINITIONS = [
  chessGameShared,
  connectFourGameShared,
] as const satisfies readonly GameDefinition[];

assertGameRegistry(GAME_DEFINITIONS);
