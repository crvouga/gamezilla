import { packProgressOnDevice } from '@libs/game-puzzle-harness-ts/content-game-reads';
import {
  completedStarters,
  playingStarter,
  starterEditions,
} from './sokoban-starter';
import type { SokobanHarness } from './sokoban-system';

const BOB = 'bob:phone';

/** The starter-pack model's view: pack positions, -1 for none. */
export async function starterPackState(s: SokobanHarness) {
  const { pack, puzzles } = starterEditions(s);
  const progress = await packProgressOnDevice(s, BOB, pack.title);
  const offered = puzzles.findIndex(
    (puzzle) => puzzle.id === progress?.next?.revisionId
  );
  return {
    activePuzzle: await playingStarter(s, BOB),
    completed: await completedStarters(s, BOB),
    offeredPuzzle: offered,
    otherProgress: await completedStarters(s, 'bob:tablet'),
  };
}
