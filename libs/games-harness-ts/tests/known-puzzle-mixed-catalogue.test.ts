import { expect, test } from 'bun:test';
import { CHESS_HARNESS_GAME } from '@libs/chess-root-harness-ts/chess-harness-game';
import {
  admitCataloguePuzzle,
  insertNewCatalogueRows,
} from '@libs/game-puzzle-shared-ts/puzzle-catalogue';
import {
  gameSystem,
  openGameHarness,
} from '@libs/game-session-harness-ts/game-system';
import { readCataloguePuzzle } from '@libs/game-session-harness-ts/puzzle-pool';
import { readCataloguePuzzles } from '@libs/game-session-harness-ts/puzzle-records';
import {
  readPuzzleOnBoard,
  readPuzzleProbe,
} from '@libs/game-session-harness-ts/puzzle-screen';
import type { HarnessWorld } from '@libs/harness-ts/spec-world';
import { createTurnGames } from '@pkgs/turn-game-shared-ts/game-rules';
import { enterKnownPuzzle, enterKnownPuzzleRated } from './steps/puzzle-world';

// The extra Lichess position served by the preloaded stack on partition 64.
const extra = admitCataloguePuzzle(
  createTurnGames([CHESS_HARNESS_GAME.shared.turnGame]),
  {
    record: {
      id: '04ZkB',
      position: '5Q2/3q3k/p1rP1pp1/1p2b2p/1B6/P6P/6P1/3R3K b - - 4 34',
      line: ['a6a5', 'f8e7', 'd7e7', 'd6e7'],
      rating: 1196,
      ratingDeviation: 75,
      popularity: 100,
      plays: 878,
      themes: ['advancedPawn', 'advantage', 'endgame', 'short'],
    },
    source: { url: null, tags: [] },
  }
);
const system = gameSystem('chess-rating-catalogue', [CHESS_HARNESS_GAME], {
  knownPuzzles: true,
  beside: [
    {
      name: 'game:preloaded-puzzle',
      seedServer: async (db) => {
        if (!extra.ok) throw new Error(extra.detail);
        await insertNewCatalogueRows(db, [extra.row], '2026-01-01T00:00:00Z');
      },
    },
  ],
});

// regression: known-puzzle-mixed-catalogue
test('a catalogue containing 04ZkB opens 01Xbe by name and distinct puzzles at 1300 and 1700', async () => {
  await using s = await openGameHarness(system);
  const world: HarnessWorld = {
    s,
    memo: new Map(),
    calls: [],
    ctx: {
      featureUri: 'specs/games/puzzle-rating.feature',
      featureName: 'Puzzle rating',
      scenarioName: 'Rated puzzles in a shared catalogue',
      scenarioLine: 58,
      packageName: '@libs/games-harness-ts',
      tags: [],
      testId: 'known-puzzle-mixed-catalogue',
      variant: { id: 'chess', label: 'chess' },
    },
  };
  const before = await s.read(readCataloguePuzzles, '');
  expect(before).toContain('04ZkB');
  await enterKnownPuzzle(world, 'alice');
  expect(await s.read(readPuzzleOnBoard, 'alice')).toBe('01Xbe');
  await enterKnownPuzzleRated(world, 'bob', 1300);
  expect((await s.read(readPuzzleProbe, 'bob'))?.puzzleRating).toBe(1300);
  const easier = await s.read(readPuzzleOnBoard, 'bob');
  if (easier === null) throw new Error('Bob has no puzzle');
  await enterKnownPuzzleRated(world, 'alice', 1700);
  expect((await s.read(readPuzzleProbe, 'alice'))?.puzzleRating).toBe(1700);
  expect(await s.read(readPuzzleOnBoard, 'alice')).not.toBe(easier);
  expect((await s.read(readCataloguePuzzle, easier))?.rating).toBe(1300);
  const after = await s.read(readCataloguePuzzles, '');
  for (const id of before) expect(after).toContain(id);
}, 120_000);
