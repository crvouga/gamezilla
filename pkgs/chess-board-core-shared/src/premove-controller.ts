/**
 * Integrate {@link createPremoveQueue} with a single-premove-compatible
 * snapshot surface for gradual adoption.
 */

import type { PremoveQueue, QueuedPremove } from './premove-queue';
import { createPremoveQueue } from './premove-queue';

export type PremoveController = {
  readonly queue: PremoveQueue;
  readonly current: () => QueuedPremove | null;
  readonly all: () => readonly QueuedPremove[];
  readonly enqueue: (m: QueuedPremove) => boolean;
  readonly clear: () => void;
  readonly shift: () => QueuedPremove | null;
};

/** Facade: `current` is the head of the queue (chess.com-style first premove). */
export function createPremoveController(max = 5): PremoveController {
  const queue = createPremoveQueue(max);
  return {
    queue,
    current: () => queue.list()[0] ?? null,
    all: () => queue.list(),
    enqueue: (m) => queue.enqueue(m),
    clear: () => queue.clear(),
    shift: () => {
      const list = queue.list();
      const head = list[0];
      if (head === undefined) return null;
      queue.clear();
      for (const rest of list.slice(1)) queue.enqueue(rest);
      return head;
    },
  };
}
