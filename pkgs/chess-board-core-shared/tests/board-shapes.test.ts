import { describe, expect, test } from 'bun:test';
import type { BoardShape } from '@pkgs/chess-board-core-shared/board-shapes';
import {
  brushFromModifiers,
  toggleShape,
} from '@pkgs/chess-board-core-shared/board-shapes';

describe('brushFromModifiers', () => {
  test('maps shift/alt/ctrl to brushes', () => {
    expect(brushFromModifiers(false, false, false)).toBe('primary');
    expect(brushFromModifiers(true, false, false)).toBe('danger');
    expect(brushFromModifiers(false, true, false)).toBe('secondary');
    expect(brushFromModifiers(false, false, true)).toBe('alt');
    expect(brushFromModifiers(true, true, true)).toBe('alt');
  });
});

describe('toggleShape', () => {
  test('adds, replaces color, then removes on same color', () => {
    let shapes: BoardShape[] = [];
    const arrow: BoardShape = {
      kind: 'arrow',
      from: 'e2',
      to: 'e4',
      color: 'primary',
    };
    shapes = toggleShape(shapes, arrow);
    expect(shapes).toHaveLength(1);

    shapes = toggleShape(shapes, { ...arrow, color: 'danger' });
    expect(shapes).toHaveLength(1);
    expect(shapes[0]?.color).toBe('danger');

    shapes = toggleShape(shapes, { ...arrow, color: 'danger' });
    expect(shapes).toHaveLength(0);
  });

  test('circles toggle independently of arrows', () => {
    let shapes: BoardShape[] = [];
    shapes = toggleShape(shapes, {
      kind: 'circle',
      square: 'e4',
      color: 'secondary',
    });
    shapes = toggleShape(shapes, {
      kind: 'arrow',
      from: 'e2',
      to: 'e4',
      color: 'primary',
    });
    expect(shapes).toHaveLength(2);
    shapes = toggleShape(shapes, {
      kind: 'circle',
      square: 'e4',
      color: 'secondary',
    });
    expect(shapes).toHaveLength(1);
    expect(shapes[0]?.kind).toBe('arrow');
  });

  test('knight flag is part of arrow identity', () => {
    let shapes: BoardShape[] = [];
    const base: BoardShape = {
      kind: 'arrow',
      from: 'b1',
      to: 'c3',
      color: 'primary',
    };
    shapes = toggleShape(shapes, base);
    shapes = toggleShape(shapes, { ...base, knight: true });
    expect(shapes).toHaveLength(2);
  });
});
