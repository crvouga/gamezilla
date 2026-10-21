/**
 * Right-button shapes: drag draws an arrow (previewed live, snapping to
 * squares), a click on one square rings it; modifier keys pick the brush.
 * Drawing the same shape again erases it ({@link toggleShape}).
 */

import type {
  BoardShape,
  ShapeBrush,
} from '@pkgs/chess-board-core-shared-ts/board-shapes';
import { toggleShape } from '@pkgs/chess-board-core-shared-ts/board-shapes';
import type {
  BoardArrow,
  Square,
} from '@pkgs/chess-board-core-shared-ts/types';
import { type Accessor, createMemo, createSignal } from 'solid-js';

/** The arrow being drawn, from its origin to the square under the pointer. */
export type ShapePreview = {
  readonly from: Square;
  readonly to: Square;
  readonly color: string;
};

export type UserShapes = {
  readonly shapes: Accessor<readonly BoardShape[]>;
  readonly arrows: Accessor<readonly BoardArrow[]>;
  /** Arrow under construction (only once it leaves its origin square). */
  readonly preview: Accessor<ShapePreview | null>;
  readonly begin: (from: Square, brush: ShapeBrush) => void;
  /** The pointer is over `square` (null: off the board). */
  readonly hover: (square: Square | null) => void;
  readonly end: (to: Square | null) => void;
  /** Abandon the stroke in progress. */
  readonly abort: () => void;
  readonly clear: () => void;
};

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
    out.push(s.knight === undefined ? arrow : { ...arrow, knight: s.knight });
  }
  return out;
}

export function createUserShapes(args?: {
  readonly onChange?: ((shapes: readonly BoardShape[]) => void) | undefined;
}): UserShapes {
  const [shapes, setShapes] = createSignal<readonly BoardShape[]>([]);
  const [stroke, setStroke] = createSignal<{
    readonly from: Square;
    readonly brush: ShapeBrush;
    readonly to: Square | null;
  } | null>(null);

  const commit = (next: readonly BoardShape[]): void => {
    setShapes(next);
    args?.onChange?.(next);
  };

  const preview = createMemo((): ShapePreview | null => {
    const s = stroke();
    if (s === null) return null;
    if (s.to === null || s.to === s.from) return null;
    return { from: s.from, to: s.to, color: s.brush };
  });
  const arrows = createMemo(() => shapesToArrows(shapes()));

  return {
    shapes,
    arrows,
    preview,
    begin(square, brush) {
      setStroke({ from: square, brush, to: square });
    },
    hover(square) {
      const s = stroke();
      if (s === null || s.to === square) return;
      setStroke({ ...s, to: square });
    },
    end(to) {
      const s = stroke();
      setStroke(null);
      if (s === null || to === null) return;
      if (to === s.from) {
        commit(
          toggleShape(shapes(), {
            kind: 'circle',
            square: s.from,
            color: s.brush,
            id: `c-${s.from}`,
          })
        );
        return;
      }
      commit(
        toggleShape(shapes(), {
          kind: 'arrow',
          from: s.from,
          to,
          color: s.brush,
          id: `${s.from}-${to}`,
        })
      );
    },
    abort() {
      setStroke(null);
    },
    clear() {
      setStroke(null);
      commit([]);
    },
  };
}
