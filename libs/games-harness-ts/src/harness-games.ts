import { BATTLESHIP_HARNESS_GAME } from '@libs/battleship-harness-ts/battleship-harness-game';
import { CHESS_HARNESS_GAME } from '@libs/chess-root-harness-ts/chess-harness-game';
import { CONNECT_FOUR_HARNESS_GAME } from '@libs/connect-four-harness-ts/connect-four-harness-game';
import type { HarnessGame } from '@libs/game-session-harness-ts/harness-game';
import {
  LIGHT_CYCLES_DUEL_HARNESS_GAME,
  LIGHT_CYCLES_QUAD_HARNESS_GAME,
  LIGHT_CYCLES_TRIO_HARNESS_GAME,
} from '@libs/light-cycles-harness-ts/light-cycles-harness-game';
import { PONG_HARNESS_GAME } from '@libs/pong-harness-ts/pong-harness-game';
import {
  QUORIDOR_HARNESS_GAME,
  QUORIDOR_HILL_HARNESS_GAME,
} from '@libs/quoridor-harness-ts/quoridor-harness-game';

/**
 * Every registered turn game as the turn suites exercise it, in registry
 * order. The test composition root, beside `PLAYABLE_GAME_DEFINITIONS`: a game added
 * there without its harness game here fails the enrollment test, so every
 * game is held to every shared scenario and contract it offers.
 */
export const HARNESS_GAMES: readonly HarnessGame[] = [
  CHESS_HARNESS_GAME,
  CONNECT_FOUR_HARNESS_GAME,
  BATTLESHIP_HARNESS_GAME,
  QUORIDOR_HARNESS_GAME,
  QUORIDOR_HILL_HARNESS_GAME,
  PONG_HARNESS_GAME,
  LIGHT_CYCLES_DUEL_HARNESS_GAME,
  LIGHT_CYCLES_TRIO_HARNESS_GAME,
  LIGHT_CYCLES_QUAD_HARNESS_GAME,
];
