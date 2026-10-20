/**
 * Probe: a puzzle-first experience.
 *
 * Supported (executable): a game offering puzzles and nothing else is
 * defined, adapted and held to every law through the public contracts, is
 * offered exactly Puzzle and Puzzle stats in a space, and plays a known
 * puzzle to its solve through the platform's shared puzzle screen.
 *
 * A solver-only game is checked without inventing an opponent or a setup
 * move; its first line action is the person's first move.
 */

import { expect, test } from 'bun:test';
import { offeredGameChoices } from '@libs/game-session-harness/game-navigation';
import {
  gameSystem,
  openGameHarness,
} from '@libs/game-session-harness/game-system';
import { assertHarnessGame } from '@libs/game-session-harness/harness-game';
import { solveKnownPuzzle } from '@libs/game-session-harness/puzzle-moves';
import {
  leavePuzzleForGameChoices,
  openGamePuzzles,
} from '@libs/game-session-harness/puzzle-screen';
import {
  capabilitiesOf,
  sharedSpecificationNeeds,
} from '@libs/games-harness/game-conformance';
import { createSpace } from '@libs/spaces-harness/space-actions';
import { refusals } from '../reference-game/faulty-game';
import {
  areasOf,
  inheritedCodeSuites,
  inheritedSpecifications,
} from './probe-verdict';
import { PUZZLE_ONLY_GAME } from './puzzle-only-game';
import { SOLO_COUNT_GAME } from './solo-count-game';

const GAME = PUZZLE_ONLY_GAME;

test('a game offering only puzzles keeps every law and is bound for rules and puzzles alone', async () => {
  expect([...refusals(GAME).keys()]).toEqual([]);
  expect(areasOf(GAME)).toEqual({
    bound: ['rules', 'puzzles'],
    unsupported: ['custom-games', 'matchmaking', 'history'],
  });
  const specifications = inheritedSpecifications(GAME);
  expect(specifications).toContain('specs/games/puzzle-play.feature');
  expect(specifications).toContain('specs/games/puzzle-attempt.qnt');
  for (const uri of specifications)
    expect(capabilitiesOf(sharedSpecificationNeeds(uri))).toEqual(['puzzles']);
  const suites = await inheritedCodeSuites(GAME);
  expect(suites).toContain('conformance/puzzles/puzzle-session');
  expect(suites).toContain('conformance/rules/game-rules');
  expect(
    suites.filter((id) => !/^conformance\/(rules|puzzles)\//.test(id))
  ).toEqual([]);
});

const SYSTEM = gameSystem('puzzle-only', [GAME], { knownPuzzles: true });

test('a space offers a puzzle-only game exactly its puzzles, played on the shared puzzle screen', async () => {
  await using s = await openGameHarness(SYSTEM, 'puzzle-only-probe');
  await s.apply(createSpace, 'alice');
  await s.apply(openGamePuzzles, 'alice', GAME.shared.id);
  await s.apply(solveKnownPuzzle, 'alice', GAME.shared.id);
  await s.apply(leavePuzzleForGameChoices, 'alice');
  expect(await s.read(offeredGameChoices, 'alice')).toEqual([
    'puzzle',
    'stats',
  ]);
}, 120_000);

test('a puzzle with no opponent is checked with every line move belonging to its solver', () => {
  expect(() => assertHarnessGame(SOLO_COUNT_GAME)).not.toThrow();
});

test('a one-person puzzle keeps every applicable law', () => {
  expect([...refusals(SOLO_COUNT_GAME).keys()]).toEqual([]);
});
