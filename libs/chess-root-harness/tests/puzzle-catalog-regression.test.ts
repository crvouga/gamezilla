import { expect, test } from 'bun:test';
import { openPuzzleFromSpace } from '@libs/chess-puzzle-harness/chess-actions';
import {
  ingestChessPuzzleCsv,
  readLocalPuzzleRow,
  readServerPuzzles,
  retireChessPuzzle,
} from '@libs/chess-puzzle-harness/chess-puzzle-data';
import { NAMED_PUZZLES } from '@libs/chess-puzzle-harness/puzzle-fixtures';
import { createSpace } from '@libs/spaces-harness/space-actions';
import { openHarness } from './open-chess-harness';

// regression: puzzle-catalog-fixtures-withhold-push
test('an open puzzle pool receives newly ingested rows and retirement tombstones', async () => {
  await using s = await openHarness('puzzle-catalog-fixtures-withhold-push');
  await s.apply(createSpace, 'alice');
  await s.apply(openPuzzleFromSpace, 'alice');
  const puzzle = NAMED_PUZZLES.twoRookClearance;
  await s.apply(ingestChessPuzzleCsv, puzzle.csv);
  expect(
    (await s.read(readServerPuzzles)).some((row) => row.id === puzzle.id)
  ).toBe(true);
  await s.until((world) => readLocalPuzzleRow(world, 'alice', puzzle.id), {
    maxMs: 20_000,
    pred: (row) => row !== null && !row.deleted,
  });
  await s.apply(retireChessPuzzle, puzzle.id);
  const retired = await s.until(
    (world) => readLocalPuzzleRow(world, 'alice', puzzle.id),
    {
      maxMs: 20_000,
      pred: (row) => row?.deleted === true,
    }
  );
  expect(retired?.deleted).toBe(true);
}, 120_000);
