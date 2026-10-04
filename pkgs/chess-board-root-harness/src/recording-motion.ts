/**
 * Motion environment for the harness: slides run on the injected virtual
 * clock and are logged as `piece:from>to@ms` so a driver can read what moved
 * and how. Squares are recovered from the one-cell transforms
 * (`translate(col·12.5cqw, row·12.5cqw)`); a pixel transform (a piece the pointer
 * left somewhere) logs as `hand`, an interpolated one as `mid`.
 */

import { xyToSquare } from '@pkgs/chess-board-core-shared/geometry';
import type { BoardOrientation } from '@pkgs/chess-board-core-shared/types';
import type {
  AnimateTransform,
  BoardMotionEnvironment,
} from '@pkgs/chess-board-root-shared/board-motion';
import type { Clock, Timers } from '@pkgs/clock-shared/types';
import { type Accessor, createSignal } from 'solid-js';

const CELL = /^translate\((-?[\d.]+)cqw, (-?[\d.]+)cqw\)$/;

type Running = {
  readonly from: string;
  readonly to: string;
  readonly start: number;
  readonly durationMs: number;
};

function cellOf(transform: string): { x: number; y: number } | null {
  const m = CELL.exec(transform);
  if (m === null) return null;
  return { x: Number(m[1]) / 12.5, y: Number(m[2]) / 12.5 };
}

export function squareOfTransform(
  transform: string,
  orientation: BoardOrientation
): string {
  const cell = cellOf(transform);
  if (cell === null) return transform.includes('px') ? 'hand' : transform;
  if (!Number.isInteger(cell.x) || !Number.isInteger(cell.y)) return 'mid';
  return xyToSquare(cell.x + 0.5, cell.y + 0.5, 8, orientation) ?? 'off';
}

/** Linear stand-in for the painted mid-flight transform. */
function paintedAt(run: Running, now: number): string {
  const from = cellOf(run.from);
  const to = cellOf(run.to);
  if (from === null || to === null) return run.to;
  const t = Math.min(1, Math.max(0, (now - run.start) / run.durationMs));
  const x = (from.x + (to.x - from.x) * t) * 12.5;
  const y = (from.y + (to.y - from.y) * t) * 12.5;
  return `translate(${x}cqw, ${y}cqw)`;
}

/** One actual retired handle survives remounting; no position is remembered. */
export type EarlierCompletionSlot = {
  callback: (() => void) | undefined;
};

export type RecordingMotion = {
  readonly env: BoardMotionEnvironment;
  readonly slides: Accessor<readonly string[]>;
  readonly active: () => number;
  readonly activePieces: () => readonly { piece: string; square: string }[];
  readonly setReducedMotion: (on: boolean) => void;
  readonly setHidden: (hidden: boolean) => void;
  /** Deliver the most recent cancelled animation's real registered callback. */
  readonly finishEarlier: () => boolean;
  readonly hasEarlierCompletion: () => boolean;
  readonly earlierCompletion: EarlierCompletionSlot;
};

export function createRecordingMotion(args: {
  readonly clock: Clock;
  readonly timers: Timers;
  readonly orientation: Accessor<BoardOrientation>;
  readonly reducedMotion: boolean;
  readonly lowEnd: boolean;
  readonly webAnimations: boolean;
  readonly earlierCompletion?: EarlierCompletionSlot;
}): RecordingMotion {
  const [slides, setSlides] = createSignal<readonly string[]>([]);
  const [reduced, setReduced] = createSignal(args.reducedMotion);
  const [hidden, setHidden] = createSignal(false);
  const running = new Map<HTMLElement, Running>();
  const earlierCompletion = args.earlierCompletion ?? { callback: undefined };
  const animate: AnimateTransform = (element, from, to, durationMs) => {
    const o = args.orientation();
    const piece = element.dataset['piece'] ?? '?';
    const line = `${piece}:${squareOfTransform(from, o)}>${squareOfTransform(to, o)}@${durationMs}`;
    setSlides((prev) => [...prev, line]);
    const run = { from, to, start: args.clock.now(), durationMs };
    running.set(element, run);
    let onFinish: (() => void) | undefined;
    const handle = args.timers.setTimeout(() => {
      if (running.get(element) === run) running.delete(element);
      onFinish?.();
    }, durationMs);
    return {
      cancel: () => {
        args.timers.clearTimeout(handle);
        if (running.get(element) === run) running.delete(element);
        if (onFinish !== undefined) earlierCompletion.callback = onFinish;
      },
      onFinish: (callback) => {
        onFinish = callback;
      },
    };
  };
  return {
    env: {
      animate: args.webAnimations ? animate : null,
      prefersReducedMotion: reduced,
      lowEnd: args.lowEnd,
      hidden,
      paintedTransform: (element) => {
        const run = running.get(element);
        return run === undefined
          ? element.style.transform
          : paintedAt(run, args.clock.now());
      },
    },
    slides,
    active: () => running.size,
    activePieces: () =>
      [...running.keys()].map((element) => ({
        piece: element.dataset['piece'] ?? '',
        square: element.dataset['pieceSquare'] ?? '',
      })),
    setReducedMotion: setReduced,
    setHidden,
    finishEarlier: () => {
      const callback = earlierCompletion.callback;
      earlierCompletion.callback = undefined;
      callback?.();
      return callback !== undefined;
    },
    hasEarlierCompletion: () => earlierCompletion.callback !== undefined,
    earlierCompletion,
  };
}
