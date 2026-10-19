import { expect, test } from 'bun:test';
import {
  ingestChessPuzzleCsv,
  readLocalPuzzleRow,
  readServerPuzzles,
} from '@libs/chess-puzzle-harness/chess-puzzle-data';
import { NAMED_PUZZLES } from '@libs/chess-puzzle-harness/puzzle-fixtures';
import { CHESS_GAME_ID } from '@libs/chess-root-harness/chess-playable';
import { retireCataloguePuzzle } from '@libs/game-session-harness/puzzle-records';
import { openGamePuzzles } from '@libs/game-session-harness/puzzle-screen';
import { createSpace } from '@libs/spaces-harness/space-actions';
import { openHarness } from './open-chess-harness';

// regression: puzzle-catalog-fixtures-withhold-push
test('an open puzzle pool receives newly ingested rows and retirement tombstones', async () => {
  await using s = await openHarness('puzzle-catalog-fixtures-withhold-push');
  await s.apply(createSpace, 'alice');
  await s.apply(openGamePuzzles, 'alice', CHESS_GAME_ID);
  const puzzle = NAMED_PUZZLES.twoRookClearance;
  await s.apply(ingestChessPuzzleCsv, puzzle.csv);
  expect(
    (await s.read(readServerPuzzles)).some((row) => row.id === puzzle.id)
  ).toBe(true);
  await s.until((world) => readLocalPuzzleRow(world, 'alice', puzzle.id), {
    maxMs: 20_000,
    pred: (row) => row !== null && !row.deleted,
  });
  await s.apply(retireCataloguePuzzle, puzzle.id);
  const retired = await s.until(
    (world) => readLocalPuzzleRow(world, 'alice', puzzle.id),
    {
      maxMs: 20_000,
      pred: (row) => row?.deleted === true,
    }
  );
  expect(retired?.deleted).toBe(true);
}, 120_000);
