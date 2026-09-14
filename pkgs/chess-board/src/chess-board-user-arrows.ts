/**
 * Right-click (or long-press equivalent) user arrows. Same from→to toggles
 * off; a new stroke replaces a prior arrow sharing the same origin.
 */

import type { BoardArrow, Square } from '@pkgs/chess-board-core/types';
import { type Accessor, createSignal } from 'solid-js';

export type UserArrows = {
  readonly arrows: Accessor<readonly BoardArrow[]>;
  readonly begin: (from: Square) => void;
  readonly end: (to: Square | null) => void;
  readonly clear: () => void;
};

export function createUserArrows(args?: {
  readonly onChange?: ((arrows: readonly BoardArrow[]) => void) | undefined;
}): UserArrows {
  const [arrows, setArrows] = createSignal<readonly BoardArrow[]>([]);
  let from: Square | null = null;

  const commit = (
    update: (prev: readonly BoardArrow[]) => readonly BoardArrow[]
  ): void => {
    setArrows((prev) => {
      const next = update(prev);
      args?.onChange?.(next);
      return next;
    });
  };

  return {
    arrows,
    begin(square) {
      from = square;
    },
    end(to) {
      const origin = from;
      from = null;
      if (origin === null || to === null || to === origin) return;
      commit((prev) => {
        const id = `${origin}-${to}`;
        if (prev.some((a) => a.id === id)) {
          return prev.filter((a) => a.id !== id);
        }
        return [...prev, { from: origin, to, id, color: 'primary' }];
      });
    },
    clear() {
      from = null;
      if (arrows().length === 0) return;
      commit(() => []);
    },
  };
}
