/**
 * The space's puzzle session (`PUZZLE_SESSIONS`) over every game offering
 * puzzles, on its known puzzles: starting one (and refusing one that cannot
 * be set up), the host's moves — the solution followed, a wrong move kept
 * on the board until a retry, a refused move changing nothing — hints,
 * retries, clearing and reclaiming the session, stepping through the line,
 * and watchers' suggestions. Every expected position, label and cell comes
 * from the game's fixtures or its own rules, never from the session.
 */

import { describe, expect, test } from 'bun:test';
import {
  PUZZLE_PLAY_STATUS,
  PuzzlePlayAttr,
} from '@libs/game-puzzle-shared/play-attr';
import {
  ClearPuzzlePlay,
  ClearPuzzleRecommendation,
  ReclaimPuzzlePlay,
  RecommendPuzzleMove,
  RequestPuzzleHint,
  ResetPuzzlePlay,
  RevealPuzzleSolution,
  SeekPuzzlePlay,
  SkipPuzzlePlay,
  StartPuzzlePlay,
  StepBackPuzzlePlay,
  StepForwardPuzzlePlay,
  SubmitPuzzleMove,
} from '@libs/game-puzzle-shared/play-messages';
import { PUZZLE_MAX_RECOMMENDATIONS } from '@libs/game-puzzle-shared/recommendations';
import { projectBoardPosition } from '@libs/game-puzzle-shared/solve-projection';
import type { RoomState } from '@pkgs/room-root-shared/types';
import { ROOM_ERROR_TYPE } from '@pkgs/room-root-shared/types';
import { forEveryGame } from '../game-suite';
import {
  apply,
  committed,
  GUEST,
  HOST,
  idleSession,
  puzzleCase,
  send,
  started,
} from './puzzle-room';

const errorOf = (result: ReturnType<typeof send>) =>
  result.ok ? null : result.error.type;

forEveryGame(import.meta.path, (game) => {
  const c = puzzleCase(game);
  const { long, layout } = c;
  const first = long.solution[0] ?? '';
  const trail = c.trail(long);
  const wrong = { ...long.wrongMove };
  /** `long` with the line followed up to `at`, by the host. */
  const followedTo = (at: number): RoomState => {
    let state = started(long);
    for (const action of long.solution.slice(
      0,
      (at - layout.start) / layout.solverStep
    ))
      state = apply(state, SubmitPuzzleMove({ uci: action }));
    return state;
  };
  const move = (action: string) => SubmitPuzzleMove({ uci: action });

  describe('starting a puzzle', () => {
    // regression: solver-only-shared-suite-parity
    test('a puzzle starts with its host solving it from the setup position', () => {
      for (const fixture of c.known) {
        const state = started(fixture);
        expect(PuzzlePlayAttr.status.from(state)).toBe(
          PUZZLE_PLAY_STATUS.solving
        );
        expect(PuzzlePlayAttr.hostIdentity.from(state)).toBe(HOST);
        expect(PuzzlePlayAttr.puzzleId.from(state)).toBe(fixture.record.id);
        expect(PuzzlePlayAttr.solveIdx.from(state)).toBe(layout.start);
        expect(PuzzlePlayAttr.layoutKey.from(state)).toBe(0);
        expect(PuzzlePlayAttr.solverSide.from(state)).toBe(fixture.solverSide);
        expect(PuzzlePlayAttr.displayPosition.from(state)).toBe(
          c.trail(fixture)[layout.start] ?? null
        );
      }
    });

    test('a one-action line is solved only when its action is setup', () => {
      const state = apply(
        idleSession(),
        StartPuzzlePlay({
          puzzleId: long.record.id,
          fen: long.record.position,
          moves: long.record.line[0] ?? '',
        })
      );
      expect(PuzzlePlayAttr.status.from(state)).toBe(
        layout.start === 1
          ? PUZZLE_PLAY_STATUS.solved
          : PUZZLE_PLAY_STATUS.solving
      );
      expect(PuzzlePlayAttr.solveIdx.from(state)).toBe(layout.start);
    });

    test('a position no game recognises, or a setup move its rules refuse, starts an invalid puzzle with its host', () => {
      const unknown = apply(
        idleSession(),
        StartPuzzlePlay({
          puzzleId: long.record.id,
          fen: 'no-game-position',
          moves: long.record.line.join(' '),
        })
      );
      expect(PuzzlePlayAttr.status.from(unknown)).toBe(
        PUZZLE_PLAY_STATUS.invalid
      );
      expect(PuzzlePlayAttr.hostIdentity.from(unknown)).toBe(HOST);
      expect(PuzzlePlayAttr.displayPosition.from(unknown)).toBeNull();
      const { at, action } = long.refusedMove;
      const refused = apply(
        idleSession(),
        StartPuzzlePlay({
          puzzleId: long.record.id,
          fen: trail[at] ?? '',
          moves: action,
        })
      );
      expect(PuzzlePlayAttr.status.from(refused)).toBe(
        PUZZLE_PLAY_STATUS.invalid
      );
    });

    test('a puzzle cannot start while another is being solved', () => {
      const result = send(
        started(long),
        StartPuzzlePlay({
          puzzleId: long.record.id,
          fen: long.record.position,
          moves: long.record.line.join(' '),
        })
      );
      expect(errorOf(result)).toBe(ROOM_ERROR_TYPE.conflict);
    });
  });

  describe("the host's moves", () => {
    test('a solution move is accepted as the rules name it, and the reply is played', () => {
      const result = send(started(long), move(first));
      if (!result.ok) throw new Error('the solution move was refused');
      const accepted = result.events[0] as {
        payload: { uci?: string; san?: string };
      };
      expect(accepted.payload).toMatchObject({
        uci: first,
        san: long.labels[layout.start],
      });
      const state = committed(started(long), result);
      expect(PuzzlePlayAttr.status.from(state)).toBe(
        PUZZLE_PLAY_STATUS.solving
      );
      expect(PuzzlePlayAttr.solveIdx.from(state)).toBe(
        layout.start + layout.solverStep
      );
      expect(PuzzlePlayAttr.displayPosition.from(state)).toBe(
        trail[layout.start + layout.solverStep] ?? null
      );
    });

    test('the last solution move solves the puzzle', () => {
      for (const fixture of c.known) {
        let state = started(fixture);
        for (const action of fixture.solution)
          state = apply(state, move(action));
        expect(PuzzlePlayAttr.status.from(state)).toBe(
          PUZZLE_PLAY_STATUS.solved
        );
        expect(PuzzlePlayAttr.solveIdx.from(state)).toBe(
          fixture.record.line.length
        );
      }
    });

    test('a wrong move is shown on the board, not applied to the reached position', () => {
      const before = followedTo(wrong.at);
      const reached = PuzzlePlayAttr.displayPosition.from(before);
      const result = send(before, move(wrong.action));
      if (!result.ok) throw new Error('the wrong move was refused');
      const rejected = result.events[0] as {
        payload: { uci?: string; san?: string };
      };
      expect(rejected.payload).toMatchObject({
        uci: wrong.action,
        san: c.labelOf(trail[wrong.at] ?? '', wrong.action),
      });
      const state = committed(before, result);
      expect(PuzzlePlayAttr.status.from(state)).toBe(PUZZLE_PLAY_STATUS.wrong);
      expect(PuzzlePlayAttr.layoutKey.from(state)).toBe(
        PuzzlePlayAttr.layoutKey.from(before) + 1
      );
      expect(PuzzlePlayAttr.displayPosition.from(state)).toBe(reached);
      expect(PuzzlePlayAttr.solveIdx.from(state)).toBe(wrong.at);
      expect(PuzzlePlayAttr.wrongAction.from(state)).toBe(wrong.action);
      expect(PuzzlePlayAttr.wrongMark.from(state)).toBe(
        c.puzzles.marks(reached ?? '', wrong.action)?.to ?? null
      );
    });

    test('the board keeps a wrong move where it was played until the retry', () => {
      const boardOf = (state: RoomState) =>
        projectBoardPosition(c.puzzleGame, {
          status: PuzzlePlayAttr.status.from(state),
          position: PuzzlePlayAttr.displayPosition.from(state),
          wrongAction: PuzzlePlayAttr.wrongAction.from(state),
        });
      const before = followedTo(wrong.at);
      const reached = PuzzlePlayAttr.displayPosition.from(before);
      expect(boardOf(before)).toBe(reached);
      const state = apply(before, move(wrong.action));
      expect(boardOf(state)).toBe(
        c.rules.play(reached ?? '', wrong.action, '', [])?.position ?? null
      );
      expect(boardOf(apply(state, ResetPuzzlePlay({})))).toBe(reached);
    });

    test('a second move while the wrong one is shown is refused', () => {
      const state = apply(followedTo(wrong.at), move(wrong.action));
      expect(errorOf(send(state, move(wrong.action)))).toBe(
        ROOM_ERROR_TYPE.conflict
      );
    });

    test('a move its rules refuse is no move and changes nothing', () => {
      const { at, action } = long.refusedMove;
      const state = followedTo(at);
      const before = JSON.stringify(state);
      expect(errorOf(send(state, move(action)))).toBe(
        ROOM_ERROR_TYPE.invalidCommand
      );
      expect(JSON.stringify(state)).toBe(before);
    });

    test('after a wrong move, a retry and the solution move go on', () => {
      let state = apply(followedTo(wrong.at), move(wrong.action));
      state = apply(state, ResetPuzzlePlay({}));
      expect(PuzzlePlayAttr.status.from(state)).toBe(
        PUZZLE_PLAY_STATUS.solving
      );
      state = apply(
        state,
        move(long.solution[(wrong.at - layout.start) / layout.solverStep] ?? '')
      );
      // Past the line's reply, or at its end when that move solves it.
      expect(PuzzlePlayAttr.solveIdx.from(state)).toBe(
        Math.min(wrong.at + layout.solverStep, long.record.line.length)
      );
    });

    test('only the host moves, and only while solving', () => {
      expect(errorOf(send(started(long), move(first), GUEST))).toBe(
        ROOM_ERROR_TYPE.unauthorized
      );
      expect(errorOf(send(idleSession(), move(first)))).toBe(
        ROOM_ERROR_TYPE.unauthorized
      );
      let solved = started(long);
      for (const action of long.solution) solved = apply(solved, move(action));
      expect(errorOf(send(solved, move(first)))).toBe(ROOM_ERROR_TYPE.conflict);
    });
  });

  describe('hints', () => {
    test("a hint shows the cells of the line's next move; the solution follows it", () => {
      const state = started(long);
      const hinted = apply(state, RequestPuzzleHint({}));
      const marks = c.puzzles.marks(trail[layout.start] ?? '', first);
      expect(PuzzlePlayAttr.hintFrom.from(hinted)).toBe(
        marks?.from ?? marks?.to ?? null
      );
      expect(PuzzlePlayAttr.hintTo.from(hinted)).toBe(marks?.to ?? null);
      expect(PuzzlePlayAttr.layoutKey.from(hinted)).toBe(
        PuzzlePlayAttr.layoutKey.from(state) + 1
      );
      expect(PuzzlePlayAttr.solutionRevealed.from(hinted)).toBe(0);
      expect(errorOf(send(state, RevealPuzzleSolution({})))).toBe(
        ROOM_ERROR_TYPE.conflict
      );
      expect(
        PuzzlePlayAttr.solutionRevealed.from(
          apply(hinted, RevealPuzzleSolution({}))
        )
      ).toBe(1);
    });

    test('a retry clears the wrong move and the hint', () => {
      let state = apply(followedTo(wrong.at), move(wrong.action));
      state = apply(state, ResetPuzzlePlay({}));
      expect(PuzzlePlayAttr.wrongAction.from(state)).toBeNull();
      expect(PuzzlePlayAttr.wrongMark.from(state)).toBeNull();
      expect(PuzzlePlayAttr.hintFrom.from(state)).toBeNull();
      expect(PuzzlePlayAttr.hintTo.from(state)).toBeNull();
    });
  });

  describe('retrying, clearing and reclaiming', () => {
    test('a retry after a wrong move undoes only the wrong move', () => {
      const deep = c.known.reduce((latest, fixture) =>
        fixture.wrongMove.at > latest.wrongMove.at ? fixture : latest
      );
      const { at, action } = deep.wrongMove;
      let state = started(deep);
      for (const solved of deep.solution.slice(
        0,
        (at - layout.start) / layout.solverStep
      ))
        state = apply(state, move(solved));
      state = apply(apply(state, move(action)), ResetPuzzlePlay({}));
      expect(PuzzlePlayAttr.status.from(state)).toBe(
        PUZZLE_PLAY_STATUS.solving
      );
      expect(PuzzlePlayAttr.displayPosition.from(state)).toBe(
        c.trail(deep)[at] ?? null
      );
      expect(PuzzlePlayAttr.solveIdx.from(state)).toBe(at);
    });

    test("the host's retry while solving returns to the setup position", () => {
      const start = started(long);
      const state = apply(apply(start, move(first)), ResetPuzzlePlay({}));
      expect(PuzzlePlayAttr.solveIdx.from(state)).toBe(layout.start);
      expect(PuzzlePlayAttr.displayPosition.from(state)).toBe(
        trail[layout.start] ?? null
      );
      expect(PuzzlePlayAttr.layoutKey.from(state)).toBeGreaterThan(
        PuzzlePlayAttr.layoutKey.from(start)
      );
      expect(PuzzlePlayAttr.hostIdentity.from(state)).toBe(HOST);
      expect(errorOf(send(start, ResetPuzzlePlay({}), GUEST))).toBe(
        ROOM_ERROR_TYPE.unauthorized
      );
      expect(errorOf(send(idleSession(), ResetPuzzlePlay({})))).toBe(
        ROOM_ERROR_TYPE.unauthorized
      );
    });

    test('clearing ends the session for anyone to start again; only the host clears it', () => {
      const state = apply(started(long), ClearPuzzlePlay({}));
      expect(PuzzlePlayAttr.status.from(state)).toBe(PUZZLE_PLAY_STATUS.idle);
      expect(PuzzlePlayAttr.puzzleId.from(state)).toBeNull();
      expect(PuzzlePlayAttr.hostIdentity.from(state)).toBeNull();
      expect(PuzzlePlayAttr.displayPosition.from(state)).toBeNull();
      expect(PuzzlePlayAttr.solveIdx.from(state)).toBe(0);
      expect(send(idleSession(), ClearPuzzlePlay({}), GUEST).ok).toBe(true);
      expect(errorOf(send(started(long), ClearPuzzlePlay({}), GUEST))).toBe(
        ROOM_ERROR_TYPE.unauthorized
      );
      const again = apply(
        state,
        StartPuzzlePlay({
          puzzleId: long.record.id,
          fen: long.record.position,
          moves: long.record.line.join(' '),
        }),
        GUEST
      );
      expect(PuzzlePlayAttr.hostIdentity.from(again)).toBe(GUEST);
    });

    test('a watcher reclaiming the session moves as its host', () => {
      const state = apply(started(long), ReclaimPuzzlePlay({}), GUEST);
      expect(PuzzlePlayAttr.hostIdentity.from(state)).toBe(GUEST);
      expect(send(state, move(first), GUEST).ok).toBe(true);
      expect(errorOf(send(started(long), ReclaimPuzzlePlay({})))).toBe(
        ROOM_ERROR_TYPE.conflict
      );
    });
  });

  describe('stepping through the line', () => {
    test('a solved puzzle stays solved while its line is stepped back', () => {
      // regression: puzzle-solved-review-resumes
      let state = started(long);
      for (const action of long.solution) state = apply(state, move(action));
      const end = long.record.line.length;
      expect(PuzzlePlayAttr.furthestSolveIdx.from(state)).toBe(end);
      state = apply(state, StepBackPuzzlePlay({}));
      expect(PuzzlePlayAttr.status.from(state)).toBe(PUZZLE_PLAY_STATUS.solved);
      expect(PuzzlePlayAttr.solveIdx.from(state)).toBe(end - 1);
      expect(PuzzlePlayAttr.displayPosition.from(state)).toBe(
        trail[end - 1] ?? null
      );
      expect(PuzzlePlayAttr.furthestSolveIdx.from(state)).toBe(end);
    });

    test('stepping walks every move, replies included, and seeking jumps to one reached', () => {
      let state = apply(started(long), move(first));
      const reached = PuzzlePlayAttr.displayPosition.from(state);
      const frontier = layout.start + layout.solverStep;
      for (let at = frontier - 1; at >= layout.start; at -= 1) {
        state = apply(state, StepBackPuzzlePlay({}));
        expect(PuzzlePlayAttr.solveIdx.from(state)).toBe(at);
        expect(PuzzlePlayAttr.displayPosition.from(state)).toBe(
          trail[at] ?? null
        );
      }
      expect(errorOf(send(state, StepBackPuzzlePlay({})))).toBe(
        ROOM_ERROR_TYPE.conflict
      );
      for (let at = layout.start + 1; at <= frontier; at += 1) {
        state = apply(state, StepForwardPuzzlePlay({}));
        expect(PuzzlePlayAttr.solveIdx.from(state)).toBe(at);
        expect(PuzzlePlayAttr.displayPosition.from(state)).toBe(
          trail[at] ?? null
        );
      }
      expect(PuzzlePlayAttr.displayPosition.from(state)).toBe(reached);
      state = apply(state, SeekPuzzlePlay({ solveIdx: layout.start }));
      expect(PuzzlePlayAttr.solveIdx.from(state)).toBe(layout.start);
      expect(PuzzlePlayAttr.furthestSolveIdx.from(state)).toBe(frontier);
      state = apply(state, SeekPuzzlePlay({ solveIdx: frontier }));
      expect(PuzzlePlayAttr.displayPosition.from(state)).toBe(reached);
    });
  });

  describe('watchers', () => {
    const solutionCells = () => {
      const marks = c.puzzles.marks(trail[layout.start] ?? '', first);
      if (marks === null) throw new Error(`${first} names no cells`);
      return { from: marks.from ?? marks.to, to: marks.to };
    };

    test('a watcher is refused every control and the session is untouched', () => {
      const state = started(long);
      const before = JSON.stringify(state);
      for (const payload of [
        RequestPuzzleHint({}),
        RevealPuzzleSolution({}),
        StepBackPuzzlePlay({}),
        StepForwardPuzzlePlay({}),
        SeekPuzzlePlay({ solveIdx: layout.start }),
        ResetPuzzlePlay({}),
        ClearPuzzlePlay({}),
        SkipPuzzlePlay({}),
      ]) {
        expect(send(state, payload, GUEST).ok).toBe(false);
        expect(JSON.stringify(state)).toBe(before);
      }
    });

    test('a watcher suggests a move by its cells while the host solves, and clears it', () => {
      const cells = solutionCells();
      expect(
        errorOf(send(idleSession(), RecommendPuzzleMove(cells), GUEST))
      ).toBe(ROOM_ERROR_TYPE.conflict);
      const state = apply(started(long), RecommendPuzzleMove(cells), GUEST);
      expect(PuzzlePlayAttr.recommendations.from(state)).toEqual({
        [GUEST]: { ...cells, seq: 1 },
      });
      expect(
        PuzzlePlayAttr.recommendations.from(
          apply(state, ClearPuzzleRecommendation({}), GUEST)
        )
      ).toEqual({});
      expect(
        send(
          started(long),
          RecommendPuzzleMove({ from: 'not-a-cell', to: cells.to }),
          GUEST
        ).ok
      ).toBe(false);
    });

    test('the oldest suggestion gives way at the cap, and the host moving clears them all', () => {
      let state = started(long);
      for (let i = 0; i <= PUZZLE_MAX_RECOMMENDATIONS; i += 1)
        state = apply(
          state,
          RecommendPuzzleMove(solutionCells()),
          `guest-${i}`
        );
      const map = PuzzlePlayAttr.recommendations.from(state);
      expect(Object.keys(map)).toHaveLength(PUZZLE_MAX_RECOMMENDATIONS);
      expect(map['guest-0']).toBeUndefined();
      expect(
        PuzzlePlayAttr.recommendations.from(apply(state, move(first)))
      ).toEqual({});
    });
  });
});
