import { describe, expect, test } from 'bun:test';
import {
  PUZZLE_OPENING_PREVIEW_MS,
  PUZZLE_OPPONENT_UNLOCK_BUFFER_MS,
  PUZZLE_PIECE_MOVE_MS,
  PUZZLE_REPLY_PREVIEW_MS,
  PUZZLE_SOLUTION_STEP_MS,
} from '@libs/chess-puzzle-shared/chess-puzzle-opponent-stage';
import { fenAtSolveIdx } from '@libs/chess-puzzle-shared/chess-puzzle-step';
import type { OpponentStagerInput } from '@libs/chess-puzzle-shared/opponent-stager';
import { createPuzzleOpponentStager } from '@libs/chess-puzzle-shared/opponent-stager';
import type { Timers } from '@pkgs/clock-shared/types';

/** Minimal deterministic timers: run callbacks in due order on `advance`. */
function createManualTimers() {
  type Entry = { at: number; cb: () => void; id: number };
  let now = 0;
  let nextId = 1;
  const pending = new Map<number, Entry>();
  const timers: Timers = {
    setTimeout(cb, ms) {
      const id = nextId++;
      pending.set(id, { at: now + ms, cb, id });
      return id;
    },
    clearTimeout(handle) {
      pending.delete(handle as number);
    },
    setInterval() {
      throw new Error('unused');
    },
    clearInterval() {},
  };
  function advance(ms: number) {
    const target = now + ms;
    for (;;) {
      const due = [...pending.values()]
        .filter((e) => e.at <= target)
        .sort((a, b) => a.at - b.at || a.id - b.id)[0];
      if (due === undefined) break;
      pending.delete(due.id);
      now = due.at;
      due.cb();
    }
    now = target;
  }
  return { timers, advance, pendingCount: () => pending.size };
}

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
// Opening ply e2e4 (opponent), human reply e7e5, opponent g1f3, human b8c6.
const MOVES = 'e2e4 e7e5 g1f3 b8c6';
const fenAt = (solveIdx: number): string => {
  const fen = fenAtSolveIdx({ fen: START, moves: MOVES, solveIdx });
  if (fen === null) throw new Error(`no fen at ${solveIdx}`);
  return fen;
};

function input(over: Partial<OpponentStagerInput>): OpponentStagerInput {
  return {
    startFen: START,
    moves: MOVES,
    displayFen: fenAt(1),
    solveIdx: 1,
    furthestSolveIdx: 1,
    status: 'solving',
    ...over,
  };
}

describe('createPuzzleOpponentStager', () => {
  test('busy status shows displayFen and never locks', () => {
    const { timers } = createManualTimers();
    const stager = createPuzzleOpponentStager(
      timers,
      input({ status: 'loading', displayFen: null })
    );
    stager.update(input({ status: 'loading', displayFen: null }));
    expect(stager.getSnapshot()).toEqual({
      boardFen: null,
      opponentAnimating: false,
    });
  });

  test('opening: holds startFen, slides to displayFen, then unlocks', () => {
    const { timers, advance } = createManualTimers();
    const stager = createPuzzleOpponentStager(
      timers,
      input({ status: 'loading', displayFen: null })
    );
    const seen: string[] = [];
    stager.subscribe(() => {
      const s = stager.getSnapshot();
      seen.push(
        `${s.boardFen === START ? 'start' : 'display'}:${s.opponentAnimating}`
      );
    });

    stager.update(input({}));
    expect(stager.getSnapshot()).toEqual({
      boardFen: START,
      opponentAnimating: true,
    });

    advance(PUZZLE_OPENING_PREVIEW_MS);
    expect(stager.getSnapshot()).toEqual({
      boardFen: fenAt(1),
      opponentAnimating: true,
    });

    advance(PUZZLE_PIECE_MOVE_MS + PUZZLE_OPPONENT_UNLOCK_BUFFER_MS);
    expect(stager.getSnapshot()).toEqual({
      boardFen: fenAt(1),
      opponentAnimating: false,
    });
    expect(seen).toEqual(['start:true', 'display:true', 'display:false']);
  });

  test('canned reply animates from the human-move FEN', () => {
    const { timers, advance } = createManualTimers();
    const stager = createPuzzleOpponentStager(
      timers,
      input({ status: 'loading', displayFen: null })
    );
    stager.update(input({}));
    advance(10_000);

    // Human played e7e5 and the opponent replied g1f3 → room jumps 1 → 3.
    stager.update(
      input({ displayFen: fenAt(3), solveIdx: 3, furthestSolveIdx: 3 })
    );
    expect(stager.getSnapshot()).toEqual({
      boardFen: fenAt(2),
      opponentAnimating: true,
    });
    advance(
      PUZZLE_REPLY_PREVIEW_MS +
        PUZZLE_PIECE_MOVE_MS +
        PUZZLE_OPPONENT_UNLOCK_BUFFER_MS
    );
    expect(stager.getSnapshot()).toEqual({
      boardFen: fenAt(3),
      opponentAnimating: false,
    });
  });

  // §5: the pre-setup position holds 400–600 ms, the reply 300–500 ms.
  test('the spec timings are what the board waits', () => {
    expect(PUZZLE_OPENING_PREVIEW_MS).toBeGreaterThanOrEqual(400);
    expect(PUZZLE_OPENING_PREVIEW_MS).toBeLessThanOrEqual(600);
    expect(PUZZLE_REPLY_PREVIEW_MS).toBeGreaterThanOrEqual(300);
    expect(PUZZLE_REPLY_PREVIEW_MS).toBeLessThanOrEqual(500);
  });

  test('input stays locked for the whole opening hold and slide', () => {
    const { timers, advance } = createManualTimers();
    const stager = createPuzzleOpponentStager(
      timers,
      input({ status: 'loading', displayFen: null })
    );
    stager.update(input({}));
    for (const step of [100, 100, 100, 100, 99]) {
      advance(step);
      expect(stager.getSnapshot().opponentAnimating).toBe(true);
    }
    advance(1 + PUZZLE_PIECE_MOVE_MS + PUZZLE_OPPONENT_UNLOCK_BUFFER_MS);
    expect(stager.getSnapshot().opponentAnimating).toBe(false);
  });

  // §6 "Show solution": every remaining ply plays out, then review.
  test('a shown solution plays the rest of the line ply by ply', () => {
    const { timers, advance } = createManualTimers();
    const stager = createPuzzleOpponentStager(
      timers,
      input({ status: 'loading', displayFen: null })
    );
    stager.update(input({}));
    advance(10_000);

    stager.update(
      input({
        displayFen: fenAt(4),
        solveIdx: 4,
        furthestSolveIdx: 4,
        status: 'revealed',
      })
    );
    expect(stager.getSnapshot()).toEqual({
      boardFen: fenAt(1),
      opponentAnimating: true,
    });
    advance(PUZZLE_SOLUTION_STEP_MS);
    expect(stager.getSnapshot().boardFen).toBe(fenAt(2));
    advance(PUZZLE_SOLUTION_STEP_MS);
    expect(stager.getSnapshot().boardFen).toBe(fenAt(3));
    advance(PUZZLE_SOLUTION_STEP_MS);
    expect(stager.getSnapshot()).toEqual({
      boardFen: fenAt(4),
      opponentAnimating: true,
    });
    advance(PUZZLE_PIECE_MOVE_MS + PUZZLE_OPPONENT_UNLOCK_BUFFER_MS);
    expect(stager.getSnapshot()).toEqual({
      boardFen: fenAt(4),
      opponentAnimating: false,
    });
  });

  test('seek / scrub snaps without animating', () => {
    const { timers, advance } = createManualTimers();
    const stager = createPuzzleOpponentStager(
      timers,
      input({ status: 'loading', displayFen: null })
    );
    stager.update(
      input({ displayFen: fenAt(3), solveIdx: 3, furthestSolveIdx: 3 })
    );
    advance(10_000);
    stager.update(
      input({ displayFen: fenAt(1), solveIdx: 1, furthestSolveIdx: 3 })
    );
    expect(stager.getSnapshot()).toEqual({
      boardFen: fenAt(1),
      opponentAnimating: false,
    });
  });

  test('a new input mid-animation cancels pending timers', () => {
    const { timers, advance, pendingCount } = createManualTimers();
    const stager = createPuzzleOpponentStager(
      timers,
      input({ status: 'loading', displayFen: null })
    );
    stager.update(input({}));
    expect(pendingCount()).toBe(2);
    stager.update(input({ status: 'loading', displayFen: null }));
    expect(pendingCount()).toBe(0);
    advance(10_000);
    expect(stager.getSnapshot().opponentAnimating).toBe(false);
  });

  test('equal inputs are idempotent; dispose clears timers', () => {
    const { timers, pendingCount } = createManualTimers();
    const stager = createPuzzleOpponentStager(
      timers,
      input({ status: 'loading', displayFen: null })
    );
    stager.update(input({}));
    const snap = stager.getSnapshot();
    stager.update(input({}));
    expect(stager.getSnapshot()).toBe(snap);
    stager.dispose();
    expect(pendingCount()).toBe(0);
  });
});
