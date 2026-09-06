/**
 * Stateful, framework-free driver over {@link planOpponentStage}: holds the
 * pre-ply FEN briefly, then slides to the post-ply FEN, then unlocks input.
 * Uses injected {@link Timers} only (no rAF) so sim pumps unlock the board
 * deterministically. UI layers bind via `getSnapshot` / `subscribe`.
 */

import type { Timers } from '@pkgs/clock';
import {
  type OpponentStagePlan,
  PUZZLE_OPPONENT_UNLOCK_BUFFER_MS,
  PUZZLE_PIECE_MOVE_MS,
  planOpponentStage,
} from './chess-puzzle-opponent-stage';
import type { SolveStatus } from './chess-puzzle-solve-status';

export type OpponentStagerInput = {
  readonly startFen: string;
  readonly moves: string;
  readonly displayFen: string | null;
  readonly solveIdx: number;
  readonly furthestSolveIdx: number;
  readonly status: SolveStatus;
};

export type OpponentStagerSnapshot = {
  /** FEN the board should render right now. */
  readonly boardFen: string | null;
  /** True while an opponent ply is previewing / sliding — lock human input. */
  readonly opponentAnimating: boolean;
};

export type PuzzleOpponentStager = {
  readonly getSnapshot: () => OpponentStagerSnapshot;
  readonly subscribe: (listener: () => void) => () => void;
  /** Feed the latest room-derived inputs (idempotent for equal inputs). */
  readonly update: (input: OpponentStagerInput) => void;
  /** Cancel pending timers. */
  readonly dispose: () => void;
};

type AnimatePlan = Extract<OpponentStagePlan, { kind: 'animate' }>;
type Cursor = { solveIdx: number; furthestSolveIdx: number };
type Phase = { fen: string; locked: boolean };

function isBusyStatus(status: SolveStatus): boolean {
  return status === 'loading' || status === 'idle' || status === 'invalid';
}

function canStage(input: OpponentStagerInput): input is OpponentStagerInput & {
  displayFen: string;
} {
  return (
    input.displayFen !== null &&
    input.displayFen.length > 0 &&
    !isBusyStatus(input.status)
  );
}

function sameInput(a: OpponentStagerInput | null, b: OpponentStagerInput) {
  return (
    a !== null &&
    a.startFen === b.startFen &&
    a.moves === b.moves &&
    a.displayFen === b.displayFen &&
    a.solveIdx === b.solveIdx &&
    a.furthestSolveIdx === b.furthestSolveIdx &&
    a.status === b.status
  );
}

class PuzzleOpponentStagerImpl implements PuzzleOpponentStager {
  private readonly timers: Timers;
  private readonly listeners = new Set<() => void>();
  private prev: Cursor = { solveIdx: -1, furthestSolveIdx: -1 };
  private lastInput: OpponentStagerInput | null = null;
  private phase: Phase | null = null;
  private displayFen: string | null = null;
  private cancelTimers: (() => void) | null = null;
  private snapshot: OpponentStagerSnapshot = {
    boardFen: null,
    opponentAnimating: false,
  };

  constructor(timers: Timers) {
    this.timers = timers;
  }

  getSnapshot = (): OpponentStagerSnapshot => this.snapshot;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  update = (input: OpponentStagerInput): void => {
    if (sameInput(this.lastInput, input)) return;
    this.lastInput = input;
    this.displayFen = input.displayFen;
    this.clearTimers();

    if (!canStage(input)) {
      this.prev = {
        solveIdx: input.solveIdx,
        furthestSolveIdx: input.furthestSolveIdx,
      };
      this.setPhase(null);
      return;
    }

    const plan = planOpponentStage({
      startFen: input.startFen,
      moves: input.moves,
      displayFen: input.displayFen,
      solveIdx: input.solveIdx,
      furthestSolveIdx: input.furthestSolveIdx,
      prevSolveIdx: this.prev.solveIdx,
      prevFurthestSolveIdx: this.prev.furthestSolveIdx,
    });
    this.prev = {
      solveIdx: input.solveIdx,
      furthestSolveIdx: input.furthestSolveIdx,
    };

    if (plan.kind === 'snap') {
      this.setPhase(null);
      return;
    }
    this.runAnimate(plan);
  };

  dispose = (): void => {
    this.clearTimers();
    this.listeners.clear();
  };

  private runAnimate(plan: AnimatePlan): void {
    this.setPhase({ fen: plan.fromFen, locked: true });
    const moveMs = PUZZLE_PIECE_MOVE_MS + PUZZLE_OPPONENT_UNLOCK_BUFFER_MS;
    const t1 = this.timers.setTimeout(() => {
      this.setPhase({ fen: plan.toFen, locked: true });
    }, plan.holdMs);
    const t2 = this.timers.setTimeout(() => {
      this.cancelTimers = null;
      this.setPhase(null);
    }, plan.holdMs + moveMs);
    this.cancelTimers = () => {
      this.timers.clearTimeout(t1);
      this.timers.clearTimeout(t2);
    };
  }

  private clearTimers(): void {
    if (this.cancelTimers === null) return;
    this.cancelTimers();
    this.cancelTimers = null;
  }

  private setPhase(phase: Phase | null): void {
    this.phase = phase;
    const next: OpponentStagerSnapshot = {
      boardFen: this.phase !== null ? this.phase.fen : this.displayFen,
      opponentAnimating: this.phase?.locked === true,
    };
    if (
      next.boardFen === this.snapshot.boardFen &&
      next.opponentAnimating === this.snapshot.opponentAnimating
    ) {
      return;
    }
    this.snapshot = next;
    for (const listener of [...this.listeners]) listener();
  }
}

export function createPuzzleOpponentStager(
  timers: Timers
): PuzzleOpponentStager {
  return new PuzzleOpponentStagerImpl(timers);
}
