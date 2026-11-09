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
