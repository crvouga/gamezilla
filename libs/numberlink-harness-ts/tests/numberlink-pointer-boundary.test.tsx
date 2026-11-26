import { expect, test } from 'bun:test';
import { fireEvent } from '@solidjs/testing-library';
import { playerFixture } from './numberlink-client-fixture';

// regression: numberlink-stationary-tap-erases-path
test('a stationary endpoint tap preserves the saved path', () => {
  const f = playerFixture();
  try {
    f.pointer('pointerdown', 0);
    f.pointer('pointerup', 2);
    const saved = f.state();
    f.pointer('pointerdown', 0);
    f.pointer('pointerup', 0);
    expect(f.state()).toBe(saved);
    expect(f.actions).toHaveLength(1);
  } finally {
    f.view.unmount();
  }
});

// regression: numberlink-pointer-reentry-draws-untraced-cells
test('leaving the board cancels a trace before reentry can bridge cells', () => {
  const f = playerFixture();
  try {
    f.pointer('pointerdown', 0);
    f.pointer('pointermove', 1);
    // The 240px-high board ends before row 4 (index 9).
    f.pointer('pointermove', 9);
    f.pointer('pointermove', 2);
    f.pointer('pointerup', 2);
    expect(f.actions).toEqual([]);
    expect(f.state()).toBe('{"paths":[]}');
  } finally {
    f.view.unmount();
  }
});

// regression: numberlink-pointer-drawing-misses-escape
test('pointer drawing focuses its start so Escape reaches the active board', () => {
  const f = playerFixture();
  try {
    f.pointer('pointerdown', 3);
    const start = f.view.getByTestId('numberlink-board-cell-3');
    expect(document.activeElement).toBe(start);
    f.pointer('pointermove', 4);
    fireEvent.keyDown(start, { key: 'Escape' });
    f.pointer('pointerup', 5);
    expect(f.actions).toEqual([]);
  } finally {
    f.view.unmount();
  }
});

test('a second finger abandons the provisional route through both releases', () => {
  const f = playerFixture();
  const finger = (type: string, id: number, x: number, y: number) =>
    fireEvent(
      f.board,
      new PointerEvent(type, {
        pointerId: id,
        isPrimary: id === 1,
        pointerType: 'touch',
        button: 0,
        clientX: x,
        clientY: y,
        bubbles: true,
        cancelable: true,
      })
    );
  try {
    finger('pointerdown', 1, 40, 40);
    finger('pointermove', 1, 120, 40);
    expect(f.board.querySelector('[data-provisional="true"]')).not.toBeNull();
    finger('pointerdown', 2, 120, 120);
    finger('pointermove', 2, 200, 180);
    finger('pointerup', 2, 200, 180);
    finger('pointermove', 1, 200, 40);
    finger('pointerup', 1, 200, 40);
    expect(f.actions).toEqual([]);
    expect(f.board.querySelector('[data-path]')).toBeNull();
    const first = f.view.getByTestId('numberlink-board-cell-0');
    fireEvent.keyDown(first, { key: '0' });
    f.pointer('pointerdown', 0);
    f.pointer('pointerup', 2);
    expect(f.actions).toHaveLength(1);
  } finally {
    f.view.unmount();
  }
});
