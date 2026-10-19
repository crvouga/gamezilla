/**
 * Stateful, framework-free driver over {@link planOpponentStage}: holds the
 * position before the move briefly, then slides to the one after it, then unlocks input.
 * Uses injected {@link Timers} only (no rAF) so harness pumps unlock the board
 * deterministically. UI layers bind via `getSnapshot` / `subscribe`.
 */

import type { Timers } from '@pkgs/clock-shared/types';
import type { OpponentStagePlan } from './opponent-stage';
import {
  PUZZLE_OPPONENT_UNLOCK_BUFFER_MS,
  PUZZLE_PIECE_MOVE_MS,
  planOpponentStage,
} from './opponent-stage';
import type { PuzzleGame } from './puzzle-setup';
import type { SolveStatus } from './solve-status';

export type OpponentStagerInput = {
  readonly startPosition: string;
  readonly moves: string;
  readonly displayPosition: string | null;
  readonly solveIdx: number;
  readonly furthestSolveIdx: number;
  readonly status: SolveStatus;
};

export type OpponentStagerSnapshot = {
  /** The position the board should render right now. */
  readonly boardPosition: string | null;
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
type Phase = { position: string; locked: boolean };

function isBusyStatus(status: SolveStatus): boolean {
  return status === 'loading' || status === 'idle' || status === 'invalid';
}

function canStage(input: OpponentStagerInput): input is OpponentStagerInput & {
  displayPosition: string;
} {
  return (
    input.displayPosition !== null &&
    input.displayPosition.length > 0 &&
    !isBusyStatus(input.status)
  );
}

function sameInput(a: OpponentStagerInput | null, b: OpponentStagerInput) {
  return (
    a !== null &&
    a.startPosition === b.startPosition &&
    a.moves === b.moves &&
    a.displayPosition === b.displayPosition &&
    a.solveIdx === b.solveIdx &&
    a.furthestSolveIdx === b.furthestSolveIdx &&
    a.status === b.status
  );
}

class PuzzleOpponentStagerImpl implements PuzzleOpponentStager {
  private readonly timers: Timers;
  private readonly game: PuzzleGame;
  private readonly listeners = new Set<() => void>();
  private prev: Cursor = { solveIdx: -1, furthestSolveIdx: -1 };
  private lastInput: OpponentStagerInput | null = null;
  private phase: Phase | null = null;
  private displayPosition: string | null = null;
  private cancelTimers: (() => void) | null = null;
  private snapshot: OpponentStagerSnapshot = {
    boardPosition: null,
    opponentAnimating: false,
  };

  constructor(timers: Timers, game: PuzzleGame, initial: OpponentStagerInput) {
    this.timers = timers;
    this.game = game;
    if (canStage(initial)) {
      this.prev = {
        solveIdx: initial.solveIdx,
        furthestSolveIdx: initial.furthestSolveIdx,
      };
    }
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
    this.displayPosition = input.displayPosition;
    this.clearTimers();

    if (!canStage(input)) {
      this.prev = {
        solveIdx: input.solveIdx,
        furthestSolveIdx: input.furthestSolveIdx,
      };
      this.setPhase(null);
      return;
    }

    const stage = planOpponentStage({
      game: this.game,
      startPosition: input.startPosition,
      moves: input.moves,
      displayPosition: input.displayPosition,
      solveIdx: input.solveIdx,
      furthestSolveIdx: input.furthestSolveIdx,
      prevSolveIdx: this.prev.solveIdx,
      prevFurthestSolveIdx: this.prev.furthestSolveIdx,
      revealed: input.status === 'revealed',
    });
    this.prev = {
      solveIdx: input.solveIdx,
      furthestSolveIdx: input.furthestSolveIdx,
    };

    if (stage.kind === 'snap') {
      this.setPhase(null);
      return;
    }
    this.runAnimate(stage);
  };

  dispose = (): void => {
    this.clearTimers();
    this.listeners.clear();
  };

  private runAnimate(stage: AnimatePlan): void {
    this.setPhase({ position: stage.fromPosition, locked: true });
    const moveMs = PUZZLE_PIECE_MOVE_MS + PUZZLE_OPPONENT_UNLOCK_BUFFER_MS;
    const handles = stage.frames.map((frame) =>
      this.timers.setTimeout(() => {
        this.setPhase({ position: frame.position, locked: true });
      }, frame.atMs)
    );
    const lastAtMs = stage.frames[stage.frames.length - 1]?.atMs ?? 0;
    handles.push(
      this.timers.setTimeout(() => {
        this.cancelTimers = null;
        this.setPhase(null);
      }, lastAtMs + moveMs)
    );
    this.cancelTimers = () => {
      for (const handle of handles) this.timers.clearTimeout(handle);
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
      boardPosition:
        this.phase !== null ? this.phase.position : this.displayPosition,
      opponentAnimating: this.phase?.locked === true,
    };
    if (
      next.boardPosition === this.snapshot.boardPosition &&
      next.opponentAnimating === this.snapshot.opponentAnimating
    ) {
      return;
    }
    this.snapshot = next;
    for (const listener of [...this.listeners]) listener();
  }
}

export function createPuzzleOpponentStager(
  timers: Timers,
  game: PuzzleGame,
  initial: OpponentStagerInput
): PuzzleOpponentStager {
  return new PuzzleOpponentStagerImpl(timers, game, initial);
}
