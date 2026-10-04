import { chessGameShared } from '@libs/chess-feature-shared/chess-game';
import type { GameDefinition } from '@libs/spaces-shared/game';
import { assertGameRegistry } from '@libs/spaces-shared/load-game-plugins';

/**
 * Authoritative shared game definitions for server (`apps/server`) and client.
 * Add a workspace dep on the game lib and append its `*GameShared` export here.
 */
export const GAME_DEFINITIONS = [
  chessGameShared,
] as const satisfies readonly GameDefinition[];

assertGameRegistry(GAME_DEFINITIONS);
