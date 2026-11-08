import { expect, test } from 'bun:test';
import { playerFixture } from './numberlink-client-fixture';

// regression: numberlink-boundary-cancellation-unexplained
test('a boundary cancellation explains recovery while preserving the saved route', () => {
  const f = playerFixture();
  try {
    f.pointer('pointerdown', 0);
    f.pointer('pointerup', 2);
    const saved = f.state();
    f.pointer('pointerdown', 3);
    f.pointer('pointermove', 4);
    f.pointer('pointermove', 9);
    expect(f.state()).toBe(saved);
    const status = f.view.getByTestId('numberlink-drawing-status');
    expect(status.getAttribute('aria-live')).toBe('polite');
    expect(status.textContent).toBe(
      'Drawing canceled. Saved paths are unchanged. Start again from a number.'
    );
    f.pointer('pointerdown', 3);
    expect(status.textContent).toBe(
      'Drag from a number to its match, or use Enter and arrow keys.'
    );
  } finally {
    f.view.unmount();
  }
});

// regression: numberlink-keyboard-start-hidden-behind-help
test('the initial drawing hint explains how to start with a keyboard', () => {
  const f = playerFixture();
  try {
    expect(f.view.getByTestId('numberlink-drawing-status').textContent).toBe(
      'Drag from a number to its match, or use Enter and arrow keys.'
    );
    expect(f.view.queryByTestId('numberlink-key-hints')).toBeNull();
  } finally {
    f.view.unmount();
  }
});

// regression: numberlink-provisional-progress-appears-stale
test('progress identifies saved counts while a provisional path is visible', () => {
  const f = playerFixture();
  try {
    f.pointer('pointerdown', 0);
    f.pointer('pointermove', 1);
    expect(f.view.getByTestId('numberlink-progress').textContent).toContain(
      'Saved: 0/3 pairs connected'
    );
    expect(f.actions).toEqual([]);
    expect(
      f.view.getByTestId('numberlink-board-cell-1').getAttribute('aria-label')
    ).toBe('B1: path 1, unfinished');
  } finally {
    f.view.unmount();
  }
});
