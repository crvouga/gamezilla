/**
 * How an attempt at every game's known puzzles ends in the space's puzzle
 * session: the clock runs from the start and stops at the end; solving,
 * a wrong move, a shown solution and a skip each decide the result once,
 * and nothing after it — a late or repeated move, another skip, the
 * solution shown — changes it; each start is its own attempt; and, for a
 * game whose puzzles show them, a win off the line or a transposed move
 * plays on in the room. Expected outcomes are the fixtures'.
 */

import { describe, expect, test } from 'bun:test';
import {
  PUZZLE_PLAY_STATUS,
  PuzzlePlayAttr,
} from '@libs/game-puzzle-shared-ts/play-attr';
import {
  ClearPuzzlePlay,
  RequestPuzzleHint,
  ResetPuzzlePlay,
  ShowPuzzleSolution,
  SkipPuzzlePlay,
  SubmitPuzzleMove,
} from '@libs/game-puzzle-shared-ts/play-messages';
import { PuzzleResultAttr } from '@libs/game-puzzle-shared-ts/play-result';
import { lineActions } from '@libs/game-puzzle-shared-ts/step';
import type { RoomState } from '@pkgs/room-root-shared-ts/types';
import { ROOM_ERROR_TYPE } from '@pkgs/room-root-shared-ts/types';
import { forEveryGame } from '../game-suite';
import {
  apply,
  committed,
  GUEST,
  HOST,
  idleSession,
  puzzleCase,
  send,
  sendAs,
  startCommand,
  started,
} from './puzzle-room';

const move = (action: string) => SubmitPuzzleMove({ uci: action });

const resultOf = (state: RoomState) => ({
  owner: PuzzleResultAttr.owner.from(state),
  outcome: PuzzleResultAttr.outcome.from(state),
  score: PuzzleResultAttr.score.from(state),
});

forEveryGame(import.meta.path, (game) => {
  const c = puzzleCase(game);
  const { long, layout } = c;
  const first = long.solution[0] ?? '';
  /** `long` solved by the host, each move a tick later. */
  const solved = (from: RoomState = started(long)): RoomState =>
    long.solution.reduce(
      (state, action, index) => apply(state, move(action), HOST, 10 + index),
      from
    );
  /** `long` with its wrong move played, the line followed up to it. */
  const wronged = (): RoomState => {
    let state = started(long);
    for (const action of long.solution.slice(
      0,
      (long.wrongMove.at - layout.start) / layout.solverStep
    ))
      state = apply(state, move(action));
    return apply(state, move(long.wrongMove.action));
  };

  describe('the clock', () => {
    test('it runs from the start through a wrong move and a retry, and stops at the solve', () => {
      const start = started(long);
      expect(PuzzlePlayAttr.startedAtMs.from(start)).toBe(1);
      expect(PuzzlePlayAttr.endedAtMs.from(start)).toBeNull();
      const retried = apply(wronged(), ResetPuzzlePlay({}), HOST, 500);
      expect(PuzzlePlayAttr.startedAtMs.from(retried)).toBe(1);
      expect(PuzzlePlayAttr.endedAtMs.from(retried)).toBeNull();
      expect(PuzzlePlayAttr.endedAtMs.from(solved())).toBe(
        10 + long.solution.length - 1
      );
      const cleared = apply(start, ClearPuzzlePlay({}));
      expect(PuzzlePlayAttr.startedAtMs.from(cleared)).toBeNull();
      expect(PuzzlePlayAttr.endedAtMs.from(cleared)).toBeNull();
    });
  });

  describe('ending an attempt', () => {
    test('the host skips a live attempt: abandoned, at that time; a watcher cannot', () => {
      const state = apply(started(long), SkipPuzzlePlay({}), HOST, 42);
      expect(PuzzlePlayAttr.status.from(state)).toBe(
        PUZZLE_PLAY_STATUS.skipped
      );
      expect(PuzzlePlayAttr.endedAtMs.from(state)).toBe(42);
      expect(resultOf(state)).toEqual({
        owner: HOST,
        outcome: 'abandoned',
        score: 0,
      });
      const refused = send(started(long), SkipPuzzlePlay({}), GUEST);
      expect(refused.ok ? null : refused.error.type).toBe(
        ROOM_ERROR_TYPE.unauthorized
      );
    });

    test('showing the solution plays the line out to its end and fails the attempt', () => {
      for (const fixture of c.known) {
        const state = apply(started(fixture), ShowPuzzleSolution({}), HOST, 7);
        expect(PuzzlePlayAttr.status.from(state)).toBe(
          PUZZLE_PLAY_STATUS.revealed
        );
        expect(PuzzlePlayAttr.solveIdx.from(state)).toBe(
          fixture.record.line.length
        );
        expect(PuzzlePlayAttr.displayPosition.from(state)).toBe(
          c.trail(fixture).at(-1) ?? null
        );
        expect(PuzzlePlayAttr.endedAtMs.from(state)).toBe(7);
        expect(resultOf(state)).toEqual({
          owner: HOST,
          outcome: 'failed',
          score: 0,
        });
      }
    });

    test('solving decides the result: solved in full, or for half after a hint', () => {
      expect(resultOf(solved())).toEqual({
        owner: HOST,
        outcome: 'solved',
        score: 1000,
      });
      const hinted = apply(started(long), RequestPuzzleHint({}));
      expect(resultOf(solved(hinted))).toEqual({
        owner: HOST,
        outcome: 'solved',
        score: 500,
      });
    });
  });

  describe('the result is decided once', () => {
    test('after the solve, a late or repeated move, a skip and the solution shown change nothing', () => {
      const state = solved();
      const before = JSON.stringify(state);
      for (const payload of [
        move(long.solution.at(-1) ?? ''),
        move(first),
        SkipPuzzlePlay({}),
        ShowPuzzleSolution({}),
      ]) {
        const late = send(state, payload);
        expect(late.ok ? null : late.error.type).toBe(ROOM_ERROR_TYPE.conflict);
      }
      expect(JSON.stringify(state)).toBe(before);
      expect(resultOf(state)).toEqual({
        owner: HOST,
        outcome: 'solved',
        score: 1000,
      });
    });

    test('a wrong move fails the attempt, and solving after the retry keeps it failed', () => {
      expect(resultOf(wronged())).toEqual({
        owner: HOST,
        outcome: 'failed',
        score: 500,
      });
      let state = apply(wronged(), ResetPuzzlePlay({}));
      for (const action of long.solution.slice(
        (long.wrongMove.at - layout.start) / layout.solverStep
      ))
        state = apply(state, move(action));
      expect(PuzzlePlayAttr.status.from(state)).toBe(PUZZLE_PLAY_STATUS.solved);
      expect(resultOf(state)).toEqual({
        owner: HOST,
        outcome: 'failed',
        score: 500,
      });
    });

    test('a skipped attempt stays abandoned: neither a move nor the solution shown revives it', () => {
      const state = apply(started(long), SkipPuzzlePlay({}));
      for (const payload of [
        move(first),
        ShowPuzzleSolution({}),
        SkipPuzzlePlay({}),
      ])
        expect(send(state, payload).ok).toBe(false);
      expect(resultOf(state).outcome).toBe('abandoned');
    });
  });

  describe('attempts', () => {
    test('distinct starts at the same clock time retain distinct attempt identities', () => {
      // regression: puzzle-attempt-clock-identity-collision
      const at = { identity: 'alice', ts: 1700000000000 };
      const run = (
        state: RoomState,
        id: string,
        payload: Parameters<typeof send>[1]
      ) => committed(state, sendAs(state, payload, { ...at, id }));
      const firstStart = run(idleSession(), 'first-start', startCommand(long));
      const retried = run(firstStart, 'retry', ResetPuzzlePlay({}));
      const cleared = run(retried, 'clear', ClearPuzzlePlay({}));
      const secondStart = run(cleared, 'second-start', startCommand(long));
      expect(PuzzleResultAttr.attempt.from(firstStart)).toBe('first-start');
      expect(PuzzleResultAttr.attempt.from(retried)).toBe('first-start');
      expect(PuzzleResultAttr.attempt.from(secondStart)).toBe('second-start');
    });
  });

  const transposing = c.known.filter(
    (fixture) => fixture.transposition !== undefined
  );
  if (transposing.length > 0)
    test('a transposed solver move plays on along the reordered line to the solve', () => {
      for (const fixture of transposing) {
        const { at, action } = fixture.transposition!;
        let state = started(fixture);
        for (const solvedMove of fixture.solution.slice(
          0,
          (at - layout.start) / layout.solverStep
        ))
          state = apply(state, move(solvedMove));
        state = apply(state, move(action));
        const line = [...fixture.record.line];
        [line[at], line[at + layout.solverStep]] = [
          line[at + layout.solverStep] ?? '',
          line[at] ?? '',
        ];
        expect(lineActions(PuzzlePlayAttr.line.from(state))).toEqual(line);
        expect(PuzzlePlayAttr.solveIdx.from(state)).toBe(
          at + layout.solverStep
        );
        for (
          let idx = at + layout.solverStep;
          idx < line.length;
          idx += layout.solverStep
        )
          state = apply(state, move(line[idx] ?? ''));
        expect(PuzzlePlayAttr.status.from(state)).toBe(
          PUZZLE_PLAY_STATUS.solved
        );
        expect(resultOf(state).outcome).toBe('solved');
      }
    });

  const winningOff = c.known.filter(
    (fixture) => fixture.wonAnotherWay !== undefined
  );
  if (winningOff.length > 0)
    test('a win off the line solves the puzzle at once', () => {
      for (const fixture of winningOff) {
        const { at, action } = fixture.wonAnotherWay!;
        let state = started(fixture);
        for (const solvedMove of fixture.solution.slice(
          0,
          (at - layout.start) / layout.solverStep
        ))
          state = apply(state, move(solvedMove));
        state = apply(state, move(action));
        expect(PuzzlePlayAttr.status.from(state)).toBe(
          PUZZLE_PLAY_STATUS.solved
        );
        expect(PuzzlePlayAttr.solveIdx.from(state)).toBe(at + 1);
        expect(resultOf(state)).toEqual({
          owner: HOST,
          outcome: 'solved',
          score: 1000,
        });
      }
    });
});
