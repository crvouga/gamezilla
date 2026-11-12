import { describe, expect, test } from 'bun:test';
import { createWindowLayout } from '@pkgs/ui-devtools-shared-ts/window-layout';
import {
  windowFlatTabKeyCommand,
  windowSeparatorKeyCommand,
  windowTabKeyCommand,
} from '@pkgs/ui-devtools-shared-ts/window-layout-keyboard';

const LAYOUT = createWindowLayout({
  direction: 'row',
  children: [['a', 'b', 'c'], ['d']],
});

describe('windowTabKeyCommand', () => {
  test('arrows, Home and End show another tab of the window, wrapping', () => {
    expect(windowTabKeyCommand(LAYOUT, 'a', { key: 'ArrowRight' })).toEqual({
      type: 'select',
      panel: 'b',
    });
    expect(windowTabKeyCommand(LAYOUT, 'a', { key: 'ArrowLeft' })).toEqual({
      type: 'select',
      panel: 'c',
    });
    expect(windowTabKeyCommand(LAYOUT, 'b', { key: 'End' })).toEqual({
      type: 'select',
      panel: 'c',
    });
    expect(windowTabKeyCommand(LAYOUT, 'a', { key: 'Home' })).toBeNull();
    expect(windowTabKeyCommand(LAYOUT, 'd', { key: 'ArrowRight' })).toBeNull();
  });

  test('Shift + arrow reorders within the tab bar and stops at its ends', () => {
    expect(
      windowTabKeyCommand(LAYOUT, 'a', { key: 'ArrowRight', shiftKey: true })
    ).toEqual({ type: 'move', panel: 'a', window: 'w1', index: 1 });
    expect(
      windowTabKeyCommand(LAYOUT, 'a', { key: 'ArrowLeft', shiftKey: true })
    ).toBeNull();
  });

  test('Alt + arrow goes to the window on that side', () => {
    expect(
      windowTabKeyCommand(LAYOUT, 'a', { key: 'ArrowRight', altKey: true })
    ).toEqual({ type: 'select', panel: 'd' });
    expect(
      windowTabKeyCommand(LAYOUT, 'a', { key: 'ArrowLeft', altKey: true })
    ).toBeNull();
  });

  test('Alt + Shift + arrow moves the panel to that side, splitting at the end', () => {
    const chord = { altKey: true, shiftKey: true };
    expect(
      windowTabKeyCommand(LAYOUT, 'a', { key: 'ArrowRight', ...chord })
    ).toEqual({ type: 'move', panel: 'a', window: 'w2' });
    expect(
      windowTabKeyCommand(LAYOUT, 'a', { key: 'ArrowDown', ...chord })
    ).toEqual({ type: 'split', panel: 'a', window: 'w1', edge: 'bottom' });
    expect(
      windowTabKeyCommand(LAYOUT, 'd', { key: 'ArrowDown', ...chord })
    ).toBeNull();
    expect(windowTabKeyCommand(LAYOUT, 'zz', { key: 'ArrowRight' })).toBeNull();
  });
});

describe('windowSeparatorKeyCommand', () => {
  const row = { split: 's1', index: 0, direction: 'row' as const };

  test('arrows along the split resize; the other axis does nothing', () => {
    expect(windowSeparatorKeyCommand(row, { key: 'ArrowRight' })).toEqual({
      type: 'resize',
      split: 's1',
      index: 0,
      delta: 0.02,
    });
    expect(
      windowSeparatorKeyCommand(row, { key: 'ArrowLeft', shiftKey: true })
    ).toMatchObject({ delta: -0.1 });
    expect(windowSeparatorKeyCommand(row, { key: 'ArrowDown' })).toBeNull();
    expect(
      windowSeparatorKeyCommand(
        { ...row, direction: 'column' },
        { key: 'ArrowDown' }
      )
    ).toMatchObject({ delta: 0.02 });
  });

  test('Home and End go to the limits, Enter evens the split', () => {
    expect(windowSeparatorKeyCommand(row, { key: 'Home' })).toMatchObject({
      delta: -1,
    });
    expect(windowSeparatorKeyCommand(row, { key: 'End' })).toMatchObject({
      delta: 1,
    });
    expect(windowSeparatorKeyCommand(row, { key: 'Enter' })).toEqual({
      type: 'equalize',
      split: 's1',
    });
  });
});

describe('windowFlatTabKeyCommand', () => {
  const panels = ['a', 'b', 'c'];

  test('the arrows walk every panel and wrap, Home and End jump', () => {
    expect(windowFlatTabKeyCommand(panels, 'a', { key: 'ArrowRight' })).toEqual(
      { type: 'select', panel: 'b' }
    );
    expect(windowFlatTabKeyCommand(panels, 'a', { key: 'ArrowLeft' })).toEqual({
      type: 'select',
      panel: 'c',
    });
    expect(windowFlatTabKeyCommand(panels, 'b', { key: 'End' })).toEqual({
      type: 'select',
      panel: 'c',
    });
    expect(windowFlatTabKeyCommand(panels, 'b', { key: 'Home' })).toEqual({
      type: 'select',
      panel: 'a',
    });
  });

  test('a key that changes nothing makes no command', () => {
    expect(windowFlatTabKeyCommand(panels, 'a', { key: 'Home' })).toBeNull();
    expect(windowFlatTabKeyCommand(panels, 'a', { key: 'Enter' })).toBeNull();
    expect(windowFlatTabKeyCommand(panels, 'zz', { key: 'End' })).toBeNull();
    expect(
      windowFlatTabKeyCommand(['a'], 'a', { key: 'ArrowRight' })
    ).toBeNull();
  });
});
