import {
  applySokobanMove,
  encodeSokobanAction,
} from '@libs/sokoban-shared-ts/sokoban-position';
import type {
  SokobanBoard,
  SokobanDirection,
  SokobanPosition,
} from '@libs/sokoban-shared-ts/sokoban-types';
import { type Accessor, createEffect, createSignal, on } from 'solid-js';
import { cellOf } from './sokoban-board-view';

/** Moves pressed while the last one is still being kept wait here, at most this many. */
const QUEUE_LIMIT = 4;

/**
 * Turns pressed directions into actions the rules accept. A refused move is
 * explained here and never sent; moves pressed while the previous one is
 * still being saved are kept in order and sent once it lands.
 */
export function createSokobanSteering(args: {
  readonly board: Accessor<SokobanBoard>;
  readonly position: Accessor<SokobanPosition>;
  readonly disabled: Accessor<boolean>;
  readonly onAction: (action: string) => void;
}) {
  const [refusal, setRefusal] = createSignal<{
    readonly code: string;
    readonly message: string;
  } | null>(null);
  const [queued, setQueued] = createSignal<readonly SokobanDirection[]>([]);
  const attempt = (direction: SokobanDirection): void => {
    const moved = applySokobanMove(args.board(), args.position(), direction);
    if (!moved.valid) {
      setRefusal(moved.issues[0] ?? null);
      setQueued([]);
      return;
    }
    setRefusal(null);
    args.onAction(encodeSokobanAction(direction));
  };
  const steer = (direction: SokobanDirection): void => {
    if (!args.disabled()) {
      attempt(direction);
      return;
    }
    setQueued((waiting) =>
      waiting.length >= QUEUE_LIMIT ? waiting : [...waiting, direction]
    );
  };
  createEffect(
    on([args.disabled, args.position], ([disabled]) => {
      const [next, ...rest] = queued();
      if (disabled || next === undefined) return;
      setQueued(rest);
      attempt(next);
    })
  );
  /** A tap beside the worker steps toward it; any other tap does nothing. */
  const tap = (index: number): void => {
    const cell = cellOf(args.board(), index);
    const worker = args.position().worker;
    const dx = cell.x - worker.x;
    const dy = cell.y - worker.y;
    if (Math.abs(dx) + Math.abs(dy) !== 1) return;
    steer(dx === 1 ? 'right' : dx === -1 ? 'left' : dy === 1 ? 'down' : 'up');
  };
  return { steer, tap, refusal };
}
