import type { SubServer } from '@libs/sub-shared/server';
import { defineSubServer } from '@libs/sub-shared/server';
import type { TurnGames } from '@pkgs/turn-game-shared/game-rules';
import { offersPuzzles } from './sub';
import { PUZZLE_TELEMETRY } from './telemetry';

/** The puzzle sub's server half: the puzzle telemetry its writes record. */
export const GAME_PUZZLE_SERVER = defineSubServer({
  name: 'game-puzzle',
  telemetryEvents: PUZZLE_TELEMETRY,
});

/** The puzzle server half exactly when a registered game offers puzzles. */
export function gamePuzzleServers(turnGames: TurnGames): readonly SubServer[] {
  return offersPuzzles(turnGames) ? [GAME_PUZZLE_SERVER] : [];
}
