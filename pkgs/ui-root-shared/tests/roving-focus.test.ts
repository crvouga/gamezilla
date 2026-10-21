import { describe, expect, test } from 'bun:test';
import {
  firstEnabledIndex,
  lastEnabledIndex,
  nextRovingIndex,
  rovingTabStop,
} from '@pkgs/ui-root-shared/roving-focus';
import {
  enqueueToast,
  removeToast,
  TOAST_MAX_VISIBLE,
} from '@pkgs/ui-root-shared/toast-queue';

const NONE = [false, false, false, false];

describe('nextRovingIndex', () => {
  test('horizontal arrows step and wrap', () => {
    const at = (key: string, current: number) =>
      nextRovingIndex({
        key,
        current,
        disabled: NONE,
        orientation: 'horizontal',
      });
    expect(at('ArrowRight', 0)).toBe(1);
    expect(at('ArrowRight', 3)).toBe(0);
    expect(at('ArrowLeft', 0)).toBe(3);
    expect(at('ArrowLeft', 2)).toBe(1);
    expect(at('ArrowDown', 0)).toBeNull();
    expect(at('Enter', 0)).toBeNull();
  });

  test('vertical arrows ignore left and right', () => {
    const at = (key: string) =>
      nextRovingIndex({
        key,
        current: 1,
        disabled: NONE,
        orientation: 'vertical',
      });
    expect(at('ArrowDown')).toBe(2);
    expect(at('ArrowUp')).toBe(0);
    expect(at('ArrowRight')).toBeNull();
  });

  test('both orientations answer all four arrows', () => {
    const at = (key: string) =>
      nextRovingIndex({ key, current: 1, disabled: NONE, orientation: 'both' });
    expect(at('ArrowRight')).toBe(2);
    expect(at('ArrowDown')).toBe(2);
    expect(at('ArrowLeft')).toBe(0);
    expect(at('ArrowUp')).toBe(0);
  });

  test('disabled items are skipped, Home and End land on enabled ends', () => {
    const disabled = [true, false, true, false, true];
    const at = (key: string, current: number) =>
      nextRovingIndex({ key, current, disabled, orientation: 'horizontal' });
    expect(at('ArrowRight', 1)).toBe(3);
    expect(at('ArrowRight', 3)).toBe(1);
    expect(at('ArrowLeft', 1)).toBe(3);
    expect(at('Home', 3)).toBe(1);
    expect(at('End', 1)).toBe(3);
  });

  test('Home and End can be turned off', () => {
    expect(
      nextRovingIndex({
        key: 'Home',
        current: 2,
        disabled: NONE,
        orientation: 'both',
        homeEnd: false,
      })
    ).toBeNull();
  });

  test('focus outside the set enters at the ends', () => {
    const at = (key: string) =>
      nextRovingIndex({
        key,
        current: -1,
        disabled: NONE,
        orientation: 'both',
      });
    expect(at('ArrowDown')).toBe(0);
    expect(at('ArrowUp')).toBe(3);
  });

  test('nothing to move to when every item is disabled or none exist', () => {
    const all = [true, true];
    expect(
      nextRovingIndex({
        key: 'ArrowRight',
        current: 0,
        disabled: all,
        orientation: 'both',
      })
    ).toBeNull();
    expect(
      nextRovingIndex({
        key: 'Home',
        current: 0,
        disabled: [],
        orientation: 'both',
      })
    ).toBeNull();
    expect(firstEnabledIndex(all)).toBeNull();
    expect(lastEnabledIndex(all)).toBeNull();
  });
});

describe('rovingTabStop', () => {
  test('the selected enabled item holds the tab stop', () => {
    expect(rovingTabStop(2, NONE)).toBe(2);
  });

  test('falls back to the first enabled item', () => {
    expect(rovingTabStop(-1, [true, false, false])).toBe(1);
    expect(rovingTabStop(0, [true, false, false])).toBe(1);
    expect(rovingTabStop(-1, [true])).toBeNull();
  });
});

describe('toast queue', () => {
  test('keeps the newest toasts, oldest pushed out first', () => {
    let entries: readonly { id: string }[] = [];
    for (const id of ['a', 'b', 'c', 'd']) {
      entries = enqueueToast(entries, { id });
    }
    expect(entries.map((e) => e.id)).toEqual(['b', 'c', 'd']);
    expect(entries).toHaveLength(TOAST_MAX_VISIBLE);
  });

  test('a repeated id replaces its toast in place', () => {
    const entries = enqueueToast(
      [
        { id: 'a', n: 1 },
        { id: 'b', n: 1 },
      ],
      { id: 'a', n: 2 }
    );
    expect(entries).toEqual([
      { id: 'a', n: 2 },
      { id: 'b', n: 1 },
    ]);
  });

  test('removeToast drops one id', () => {
    expect(removeToast([{ id: 'a' }, { id: 'b' }], 'a')).toEqual([{ id: 'b' }]);
  });
});
