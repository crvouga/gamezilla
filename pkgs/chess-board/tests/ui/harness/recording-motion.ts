/**
 * Motion environment for the harness: slides run on the injected virtual
 * clock and are logged as `piece:from>to@ms` so a driver can read what moved
 * and how. Squares are recovered from the one-cell transforms
 * (`translate(col·100%, row·100%)`); a pixel transform (a piece the pointer
 * left somewhere) logs as `hand`, an interpolated one as `mid`.
 */

import type {
  AnimateTransform,
  BoardMotionEnvironment,
} from '@pkgs/chess-board/board-motion';
import { xyToSquare } from '@pkgs/chess-board-core/geometry';
import type { BoardOrientation } from '@pkgs/chess-board-core/types';
import type { Clock, Timers } from '@pkgs/clock/types';
import { type Accessor, createSignal } from 'solid-js';

const PERCENT = /^translate\((-?[\d.]+)%, (-?[\d.]+)%\)$/;

type Running = {
  readonly from: string;
  readonly to: string;
  readonly start: number;
  readonly durationMs: number;
};

function cellOf(transform: string): { x: number; y: number } | null {
  const m = PERCENT.exec(transform);
  if (m === null) return null;
  return { x: Number(m[1]) / 100, y: Number(m[2]) / 100 };
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
  const x = (from.x + (to.x - from.x) * t) * 100;
  const y = (from.y + (to.y - from.y) * t) * 100;
  return `translate(${x}%, ${y}%)`;
}

export type RecordingMotion = {
  readonly env: BoardMotionEnvironment;
  readonly slides: Accessor<readonly string[]>;
  readonly setReducedMotion: (on: boolean) => void;
};

export function createRecordingMotion(args: {
  readonly clock: Clock;
  readonly timers: Timers;
  readonly orientation: Accessor<BoardOrientation>;
  readonly reducedMotion: boolean;
  readonly lowEnd: boolean;
  readonly webAnimations: boolean;
}): RecordingMotion {
  const [slides, setSlides] = createSignal<readonly string[]>([]);
  const [reduced, setReduced] = createSignal(args.reducedMotion);
  const running = new Map<HTMLElement, Running>();
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
      hidden: () => false,
      paintedTransform: (element) => {
        const run = running.get(element);
        return run === undefined
          ? element.style.transform
          : paintedAt(run, args.clock.now());
      },
    },
    slides,
    setReducedMotion: setReduced,
  };
}
