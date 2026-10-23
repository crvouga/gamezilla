import type { SubServer } from '@libs/sub-shared-ts/server';
import { defineSubServer } from '@libs/sub-shared-ts/server';
import type { TurnGames } from '@pkgs/turn-game-shared-ts/game-rules';
import { puzzleContentTopic } from './content-topic-map';
import { puzzleCatalogueTopic } from './puzzle-catalogue';
import { offersPuzzles } from './sub';
import { PUZZLE_TELEMETRY } from './telemetry';

/**
 * The puzzle sub's server half: the puzzle telemetry its writes record, and
 * the catalogue topic every device's puzzle queries subscribe to.
 */
export const GAME_PUZZLE_SERVER = defineSubServer({
  name: 'game-puzzle',
  telemetryEvents: PUZZLE_TELEMETRY,
  // The catalogue every device reads: without this grant AWS IoT refuses the
  // subscription and the device drops its whole session, forever.
  pubsubTopics: async () => [puzzleCatalogueTopic(), puzzleContentTopic],
});

/** The puzzle server half exactly when a registered game offers puzzles. */
export function gamePuzzleServers(turnGames: TurnGames): readonly SubServer[] {
  return offersPuzzles(turnGames) ? [GAME_PUZZLE_SERVER] : [];
}
