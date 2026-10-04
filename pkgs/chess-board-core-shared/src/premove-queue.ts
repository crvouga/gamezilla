/**
 * Configurable multi-premove queue (Phase 4). Framework-free; Solid / DOM
 * layers subscribe and render ghosts from {@link PremoveQueue.list}.
 */

import type { Move, Square } from './types';

export type QueuedPremove = {
  from: Square;
  to: Square;
  promotion?: NonNullable<Move['promotion']>;
};

export type PremoveQueue = {
  list(): readonly QueuedPremove[];
  /** False when the queue is at capacity or already contains this move. */
  enqueue(m: QueuedPremove): boolean;
  clear(): void;
  cancelLast(): void;
  setMax(n: number): void;
  subscribe(fn: () => void): () => void;
};

const DEFAULT_MAX = 5;

export function createPremoveQueue(max: number = DEFAULT_MAX): PremoveQueue {
  let items: QueuedPremove[] = [];
  let maxN = Math.max(1, Math.floor(max));
  const listeners = new Set<() => void>();

  const notify = (): void => {
    for (const fn of listeners) fn();
  };

  return {
    list: () => items,
    enqueue(m) {
      if (
        items.length >= maxN ||
        items.some(
          (queued) =>
            queued.from === m.from &&
            queued.to === m.to &&
            queued.promotion === m.promotion
        )
      )
        return false;
      items = [...items, m];
      notify();
      return true;
    },
    clear() {
      if (items.length === 0) return;
      items = [];
      notify();
    },
    cancelLast() {
      if (items.length === 0) return;
      items = items.slice(0, -1);
      notify();
    },
    setMax(n) {
      const next = Math.max(1, Math.floor(n));
      if (next === maxN && items.length <= next) {
        maxN = next;
        return;
      }
      maxN = next;
      if (items.length > maxN) items = items.slice(0, maxN);
      notify();
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
  };
}
