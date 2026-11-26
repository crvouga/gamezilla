import { packProgressOnDevice } from '@libs/game-puzzle-harness-ts/content-game-reads';
import { sokobanStarterPack } from '@libs/sokoban-shared-ts/sokoban-starter-pack';
import { completedStarters, playingStarter } from './sokoban-starter';
import type { SokobanHarness } from './sokoban-system';

const BOB = 'bob:phone';

/** The starter-pack model's view: pack positions, -1 for none. */
export async function starterPackState(s: SokobanHarness) {
  const progress = await packProgressOnDevice(s, BOB, sokobanStarterPack.title);
  const offered =
    progress?.items.findIndex(
      (puzzle) => puzzle.revisionId === progress.next?.revisionId
    ) ?? -1;
  return {
    activePuzzle: await playingStarter(s, BOB),
    completed: await completedStarters(s, BOB),
    offeredPuzzle: offered,
    otherProgress: await completedStarters(s, 'bob:tablet'),
  };
}
