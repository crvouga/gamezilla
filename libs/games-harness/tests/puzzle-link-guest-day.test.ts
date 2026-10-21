/**
 * A guest's puzzles of the day, as the daily-limit scenarios set them up,
 * never include the puzzle a scenario names: Solo count knows three
 * puzzles, so its feed served a guest the game's known puzzle a third of
 * the time, and the puzzle link to it then opened a puzzle already played
 * — unrated, with no puzzle start used.
 */

import { expect, test } from 'bun:test';
import {
  gameSystem,
  openGameHarness,
} from '@libs/game-session-harness/game-system';
import {
  startUnnamedPuzzle,
  useUpPuzzleStartsToday,
} from '@libs/game-session-harness/puzzle-allowance';
import {
  openPuzzleLink,
  puzzleLinkTo,
} from '@libs/game-session-harness/puzzle-link';
import {
  solveKnownPuzzle,
  theKnownPuzzle,
} from '@libs/game-session-harness/puzzle-moves';
import { hasPlayedPuzzle } from '@libs/game-session-harness/puzzle-records';
import {
  readPuzzleOnBoard,
  readPuzzleStartsLeft,
} from '@libs/game-session-harness/puzzle-screen';
import { createSpace } from '@libs/spaces-harness/space-actions';
import { SOLO_COUNT_GAME } from './probes/solo-count-game';

const SYSTEM = gameSystem('puzzle-link-guest-day', [SOLO_COUNT_GAME], {
  knownPuzzles: true,
});
const GAME_ID = SOLO_COUNT_GAME.shared.id;
const KNOWN = theKnownPuzzle(SOLO_COUNT_GAME).record.id;

// regression: puzzle-guest-day-plays-linked-puzzle
test('a guest who has played 18 Solo count puzzles today opens the link to the known puzzle as a first attempt', async () => {
  await using s = await openGameHarness(SYSTEM, 'puzzle-link-guest-day');
  await s.apply(createSpace, 'bob');
  await s.apply(startUnnamedPuzzle, 'bob', GAME_ID);
  expect(await s.read(readPuzzleOnBoard, 'bob')).not.toBe(KNOWN);
  await s.apply(useUpPuzzleStartsToday, 'bob', 18);
  await s.apply(solveKnownPuzzle, 'bob', GAME_ID);
  expect(await s.read(hasPlayedPuzzle, 'bob', KNOWN)).toBe(false);

  await s.apply(openPuzzleLink, 'bob', puzzleLinkTo(KNOWN));
  await s.until((surf) => readPuzzleOnBoard(surf, 'bob'), {
    maxMs: 20_000,
    pred: (id) => id === KNOWN,
  });
  const left = await s.until((surf) => readPuzzleStartsLeft(surf, 'bob'), {
    maxMs: 20_000,
    pred: (remaining) => remaining === 1,
  });
  expect(left).toBe(1);
}, 120_000);
