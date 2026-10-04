import { chessGameClient } from '@libs/chess-client/chess-game-def';
import { GAME_DEFINITIONS } from '@libs/games-shared/game-plugins';
import type { GameClientDefinition } from '@libs/spaces-shared/game';
import {
  assertGameRegistry,
  assertMatchingGameIds,
} from '@libs/spaces-shared/load-game-plugins';

/**
 * Client UI definitions for each game in {@link GAME_DEFINITIONS}.
 * Not imported by `apps/server`.
 */
export const GAME_CLIENT_DEFINITIONS = [
  chessGameClient,
] as const satisfies readonly GameClientDefinition[];

assertGameRegistry(GAME_CLIENT_DEFINITIONS);
assertMatchingGameIds(GAME_DEFINITIONS, GAME_CLIENT_DEFINITIONS);
