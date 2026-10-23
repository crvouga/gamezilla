/**
 * Probe: a play surface unlike a chessboard.
 *
 * Supported (executable): the reference game's board is a row of buttons
 * ("Count one from 3"), not a grid, and its puzzle board a list of counts;
 * it keeps every presentation and puzzle law and runs every shared
 * specification it offers (`counting-race-game.tsx`, the conformance
 * matrix). Every probe game here is a bare button list too.
 *
 * Limitation (executable, type-level): puzzles mark cells. A hint, a wrong
 * move, the shown solution and a watcher's suggestion name the cells an
 * action touches (`PuzzleMarks`: `from`, `to`; `isCell`), so a puzzle
 * surface must have addressable cells (the race's are its counts). The
 * board is also handed a side to face (`orientation: GameSide`), and
 * `GameAutomation.perform` is one pointer gesture, so no shared scenario
 * plays by keyboard or hears a move (GAME_FRAMEWORK.md, Known limits).
 */

import { expect, test } from 'bun:test';
import type { PuzzleMarks } from '@pkgs/turn-game-shared-ts/game-puzzles';
import {
  COUNTING_RACE_GAME,
  COUNTING_RACE_PUZZLES,
} from '../reference-game/counting-race-game';
import { refusals } from '../reference-game/faulty-game';
import { areasOf } from './probe-verdict';

test('a board of buttons keeps every presentation and puzzle law', () => {
  expect([...refusals(COUNTING_RACE_GAME).keys()]).toEqual([]);
  expect(areasOf(COUNTING_RACE_GAME).bound).toContain('puzzles');
});

test("a puzzle surface's cells are whatever the game names: the race's counts", () => {
  expect(COUNTING_RACE_PUZZLES.marks('race:3w', 'leap')).toEqual({
    from: '3',
    to: '5',
  });
  expect(COUNTING_RACE_PUZZLES.isCell('5')).toBe(true);
  expect(COUNTING_RACE_PUZZLES.isCell('e4')).toBe(false);
  // @ts-expect-error: a mark names the cell an action reaches; a surface without cells has none.
  const unmarked: PuzzleMarks = { from: null };
  expect(unmarked.from).toBeNull();
});
