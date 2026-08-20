import { chessGameShared } from '@libs/chess/public/chess-game';
import type { GameDefinition } from '@libs/spaces/public/game';
import { assertGameRegistry } from '@libs/spaces/public/load-game-plugins';

/**
 * Authoritative shared game definitions for server (`apps/server`) and client.
 * Add a workspace dep on the game lib and append its `*GameShared` export here.
 */
export const GAME_DEFINITIONS = [
  chessGameShared,
] as const satisfies readonly GameDefinition[];

assertGameRegistry(GAME_DEFINITIONS);
