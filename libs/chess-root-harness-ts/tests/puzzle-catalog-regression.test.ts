import { expect, test } from 'bun:test';
import {
  openNamedChessPuzzle,
  playUntilSolved,
} from '@libs/chess-puzzle-harness-ts/chess-actions';
import {
  ingestChessPuzzleCsv,
  readLocalPuzzleRow,
  readServerPuzzles,
} from '@libs/chess-puzzle-harness-ts/chess-puzzle-data';
import { NAMED_PUZZLES } from '@libs/chess-puzzle-harness-ts/puzzle-fixtures';
import { preparePuzzleModelPool } from '@libs/chess-puzzle-harness-ts/puzzle-model-pool';
import { CHESS_GAME_ID } from '@libs/chess-root-harness-ts/chess-playable';
import {
  openPuzzleLink,
  puzzleLinkTo,
} from '@libs/game-session-harness-ts/puzzle-link';
import { retireCataloguePuzzle } from '@libs/game-session-harness-ts/puzzle-records';
import {
  isPuzzleSolved,
  openGamePuzzles,
  readPuzzleOnBoard,
} from '@libs/game-session-harness-ts/puzzle-screen';
import { signInWithGoogle } from '@libs/harness-ts/auth-actions';
import { createSpace } from '@libs/spaces-harness-ts/space-actions';
import { openHarness } from './open-chess-harness';
import { ASSISTANT_PUZZLES } from './steps/assistant-fixtures';

// regression: puzzle-catalog-fixtures-withhold-push
test('an open puzzle pool receives newly ingested rows and retirement tombstones', async () => {
  await using s = await openHarness();
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

// regression: repeated-chess-model-pool-loses-puzzles
test('repeated puzzle assistant scenarios restore all three puzzles on a shared catalogue', async () => {
  await using s = await openHarness();
  await s.apply(preparePuzzleModelPool);
  await s.apply(retireCataloguePuzzle, '002X3');
  await s.apply(preparePuzzleModelPool);
  expect((await s.read(readServerPuzzles)).map((row) => row.id)).toEqual([
    '002X3',
    '007mr',
    '01Xbe',
  ]);
});

// regression: chess-inspection-help-puzzle-drag
// regression: chess-named-puzzle-already-on-board
test('opening the four-move mate already on the board keeps its attempt playable', async () => {
  await using s = await openHarness();
  const actor = 'alice';
  const puzzle = NAMED_PUZZLES.fourMoveMateInTwo;
  await s.apply(signInWithGoogle, actor);
  await s.apply(createSpace, actor);
  await s.apply(openGamePuzzles, actor, CHESS_GAME_ID);
  await s.apply(openPuzzleLink, actor, puzzleLinkTo(puzzle.id));
  await s.until((world) => readPuzzleOnBoard(world, actor), {
    maxMs: 20_000,
    pred: (id) => id === puzzle.id,
  });
  await s.apply(openNamedChessPuzzle, actor, puzzle.id);
  expect(await s.read(readPuzzleOnBoard, actor)).toBe('01Xbe');
  await s.apply(playUntilSolved, actor);
  await s.until((world) => isPuzzleSolved(world, actor), { maxMs: 15_000 });
}, 120_000);

// regression: named-chess-puzzle-shared-theme
test('named puzzles stay selectable when three positions share the fork theme', async () => {
  await using s = await openHarness();
  const actor = 'alice';
  const { fork, falseFork } = ASSISTANT_PUZZLES;
  for (const puzzle of [fork, falseFork, ASSISTANT_PUZZLES.exposed])
    await s.apply(
      ingestChessPuzzleCsv,
      puzzle.csv.replace('hangingPiece', 'fork')
    );
  await s.apply(signInWithGoogle, actor);
  await s.apply(createSpace, actor);
  await s.apply(openPuzzleLink, actor, puzzleLinkTo(falseFork.id));
  await s.until((world) => readPuzzleOnBoard(world, actor), {
    maxMs: 20_000,
    pred: (id) => id === falseFork.id,
  });
  await s.apply(openNamedChessPuzzle, actor, fork.id);
  expect(await s.read(readPuzzleOnBoard, actor)).toBe('coachFork');
  await s.apply(openNamedChessPuzzle, actor, falseFork.id);
  expect(await s.read(readPuzzleOnBoard, actor)).toBe(falseFork.id);
}, 120_000);
