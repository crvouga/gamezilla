import type { SubServer } from '@libs/sub-shared-ts/server';
import { defineSubServer } from '@libs/sub-shared-ts/server';
import { puzzleContentTopic } from './content-topic-map';
import { puzzleCatalogueTopic } from './puzzle-catalogue';
import { offersPuzzles, type PuzzleGameOffering } from './sub';
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
export function gamePuzzleServers(
  games: readonly PuzzleGameOffering[]
): readonly SubServer[] {
  return offersPuzzles(games) ? [GAME_PUZZLE_SERVER] : [];
}
