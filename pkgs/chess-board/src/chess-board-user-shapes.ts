/**
 * Right-click shapes: arrows (drag) and circles (click same square), with
 * modifier-key brushes. Builds on {@link toggleShape}.
 */

import {
  brushFromModifiers,
  type BoardShape,
  type ShapeBrush,
  toggleShape,
} from '@pkgs/chess-board-core/shapes/board-shapes';
import type { BoardArrow, Square } from '@pkgs/chess-board-core/types';
import { type Accessor, createSignal } from 'solid-js';

export type UserShapes = {
  readonly shapes: Accessor<readonly BoardShape[]>;
  readonly arrows: Accessor<readonly BoardArrow[]>;
  readonly begin: (from: Square, brush: ShapeBrush) => void;
  readonly end: (to: Square | null) => void;
  readonly clear: () => void;
  readonly setShapes: (shapes: readonly BoardShape[]) => void;
};

function brushToColorKey(brush: ShapeBrush): string {
  return brush;
}

function shapesToArrows(shapes: readonly BoardShape[]): readonly BoardArrow[] {
  const out: BoardArrow[] = [];
  for (const s of shapes) {
    if (s.kind !== 'arrow') continue;
    const arrow: BoardArrow = {
      from: s.from,
      to: s.to,
      color: s.color,
      id: s.id ?? `${s.from}-${s.to}`,
    };
    if (s.knight !== undefined) {
      out.push({ ...arrow, knight: s.knight });
    } else {
      out.push(arrow);
    }
  }
  return out;
}

export function createUserShapes(args?: {
  readonly onChange?: ((shapes: readonly BoardShape[]) => void) | undefined;
}): UserShapes {
  const [shapes, setShapes] = createSignal<readonly BoardShape[]>([]);
  let from: Square | null = null;
  let brush: ShapeBrush = 'primary';

  const commit = (next: readonly BoardShape[]): void => {
    setShapes(next);
    args?.onChange?.(next);
  };

  return {
    shapes,
    arrows: () => shapesToArrows(shapes()),
    begin(square, nextBrush) {
      from = square;
      brush = nextBrush;
    },
    end(to) {
      const origin = from;
      from = null;
      if (origin === null || to === null) return;
      const color = brushToColorKey(brush);
      if (to === origin) {
        commit(
          toggleShape(shapes(), {
            kind: 'circle',
            square: origin,
            color,
            id: `c-${origin}`,
          })
        );
        return;
      }
      commit(
        toggleShape(shapes(), {
          kind: 'arrow',
          from: origin,
          to,
          color,
          id: `${origin}-${to}`,
        })
      );
    },
    clear() {
      from = null;
      if (shapes().length === 0) return;
      commit([]);
    },
    setShapes(next) {
      commit(next);
    },
  };
}

export { brushFromModifiers };
