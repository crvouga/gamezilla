import type {
  BoardShape,
  ShapeBrush,
} from '@pkgs/chess-board-core-shared-ts/board-shapes';
import { isSquare } from '@pkgs/chess-board-core-shared-ts/geometry';
import type { Square } from '@pkgs/chess-board-core-shared-ts/types';
import { definePrimitive } from '@ui-sdk/core';
import { createParts } from '@ui-sdk/solid/primitive';

const BRUSHES: readonly ShapeBrush[] = [
  'primary',
  'secondary',
  'alt',
  'danger',
];

type AnnotationOptions = {
  disabled: boolean;
  value: readonly BoardShape[];
  onToggle: (from: Square, to: Square, brush: ShapeBrush) => void;
  onClear: () => void;
};

function annotationState(options: AnnotationOptions) {
  return { value: options.value, disabled: options.disabled, brushes: BRUSHES };
}

function square(value: unknown): Square {
  if (typeof value !== 'string' || !isSquare(value))
    throw new Error('Choose a chess square from a1 through h8.');
  return value;
}

function brush(value: unknown): ShapeBrush {
  if (value === undefined) return 'primary';
  const chosen = BRUSHES.find((candidate) => candidate === value);
  if (chosen === undefined)
    throw new Error(`Choose one of these brushes: ${BRUSHES.join(', ')}.`);
  return chosen;
}

const annotations = definePrimitive({
  name: 'chess-annotations',
  options: {
    disabled: 'boolean',
    value: 'list',
    onToggle: 'callback',
    onClear: 'callback',
  },
  state: annotationState,
  sync: annotationState,
  controlled: ['value', 'brushes'],
  api: (context) => {
    const options = () => {
      const current = context.options();
      if (current.disabled)
        throw new Error('Drawing on this board is disabled.');
      return current;
    };
    return {
      toggleArrow(from: unknown, to: unknown, color?: unknown) {
        const start = square(from);
        const end = square(to);
        if (start === end)
          throw new Error('Choose two different squares for an arrow.');
        options().onToggle(start, end, brush(color));
      },
      toggleCircle(at: unknown, color?: unknown) {
        const target = square(at);
        options().onToggle(target, target, brush(color));
      },
      clearAnnotations() {
        options().onClear();
      },
    };
  },
  slots: (slot) => ({ root: slot({ attrs: () => ({ role: 'group' }) }) }),
  agent: {
    actions: ['toggleArrow', 'toggleCircle', 'clearAnnotations'],
    shown: (state) => !state.disabled || state.value.length > 0,
  },
});

export const { Root: ChessAnnotations } = createParts(annotations, {
  root: 'div',
});
