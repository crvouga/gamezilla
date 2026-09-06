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

export function createUserArrows(): UserArrows {
  const [arrows, setArrows] = createSignal<readonly BoardArrow[]>([]);
  let from: Square | null = null;

  return {
    arrows,
    begin(square) {
      from = square;
    },
    end(to) {
      const origin = from;
      from = null;
      if (origin === null || to === null || to === origin) return;
      setArrows((prev) => {
        const id = `${origin}-${to}`;
        if (prev.some((a) => a.id === id)) {
          return prev.filter((a) => a.id !== id);
        }
        return [...prev, { from: origin, to, id, color: 'primary' }];
      });
    },
    clear() {
      from = null;
      setArrows([]);
    },
  };
}
