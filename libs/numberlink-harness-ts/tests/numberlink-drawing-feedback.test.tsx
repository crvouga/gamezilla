import { expect, test } from 'bun:test';
import { LONG_LABEL_NUMBERLINK } from '@libs/numberlink-client-ts/numberlink-extremes.example';
import { NumberlinkPlayer } from '@libs/numberlink-client-ts/numberlink-player';
import { fireEvent } from '@solidjs/testing-library';
import { playerFixture, renderNumberlink } from './numberlink-client-fixture';

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
      'Drawing canceled. Saved paths are unchanged. Start again from an endpoint.'
    );
    f.pointer('pointerdown', 3);
    expect(status.textContent).toBe(
      'Drawing 2. Finish on its matching endpoint to save it.'
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
      'Drag from an endpoint to its match, or use Enter and arrow keys.'
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

// regression: numberlink-escape-cancel-unexplained
test('Escape explains a canceled keyboard or mouse drawing like any other cancel', () => {
  const f = playerFixture();
  try {
    const status = f.view.getByTestId('numberlink-drawing-status');
    const first = f.view.getByTestId('numberlink-board-cell-0');
    first.focus();
    // A real Enter on a focused button clicks it; that click starts drawing.
    fireEvent.click(first, { detail: 0 });
    fireEvent.keyDown(first, { key: 'ArrowRight' });
    const next = f.view.getByTestId('numberlink-board-cell-1');
    fireEvent.keyDown(next, { key: 'Escape' });
    expect(f.actions).toEqual([]);
    expect(status.textContent).toBe(
      'Drawing canceled. Saved paths are unchanged. Start again from an endpoint.'
    );
    f.pointer('pointerdown', 0);
    expect(status.textContent).toBe(
      'Drawing 1. Finish on its matching endpoint to save it.'
    );
    f.pointer('pointermove', 1);
    fireEvent.keyDown(f.view.getByTestId('numberlink-board-cell-0'), {
      key: 'Escape',
    });
    f.pointer('pointerup', 1);
    expect(f.actions).toEqual([]);
    expect(status.textContent).toBe(
      'Drawing canceled. Saved paths are unchanged. Start again from an endpoint.'
    );
    fireEvent.keyDown(f.view.getByTestId('numberlink-board-cell-0'), {
      key: 'Escape',
    });
    expect(status.textContent).toBe(
      'Drawing canceled. Saved paths are unchanged. Start again from an endpoint.'
    );
  } finally {
    f.view.unmount();
  }
});

// regression: numberlink-hint-says-number-for-word-labels
test('a puzzle with word labels is not told to start from a number', () => {
  const view = renderNumberlink(() => (
    <NumberlinkPlayer
      definition={JSON.stringify(LONG_LABEL_NUMBERLINK)}
      state='{"paths":[]}'
      disabled={false}
      onAction={() => undefined}
    />
  ));
  try {
    const hint = view.getByTestId('numberlink-drawing-status').textContent;
    expect(hint).toBe(
      'Drag from an endpoint to its match, or use Enter and arrow keys.'
    );
    expect(hint).not.toContain('number');
  } finally {
    view.unmount();
  }
});

// regression: numberlink-provisional-path-looks-saved
test('a path being drawn is marked provisional until it is saved', () => {
  const f = playerFixture();
  try {
    const line = () => f.board.querySelector('polyline[data-path="pair-1"]');
    f.pointer('pointerdown', 0);
    f.pointer('pointermove', 1);
    expect(line()?.getAttribute('data-provisional')).toBe('true');
    expect(f.view.getByTestId('numberlink-drawing-status').textContent).toBe(
      'Drawing 1. Finish on its matching endpoint to save it.'
    );
    f.pointer('pointerup', 1);
    expect(f.actions).toHaveLength(1);
    expect(line()?.getAttribute('data-provisional')).toBe('false');
  } finally {
    f.view.unmount();
  }
});
