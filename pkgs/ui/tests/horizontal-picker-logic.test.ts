import {
  centeringPadding,
  clampIndex,
  createPickerScrollTracker,
  indexFromOffset,
  offsetForIndex,
} from '@pkgs/ui/components/horizontal-picker';
import { describe, expect, test } from 'vitest';

describe('horizontal-picker math', () => {
  test('indexFromOffset rounds to the nearest cell and guards zero width', () => {
    expect(indexFromOffset(0, 120)).toBe(0);
    expect(indexFromOffset(59, 120)).toBe(0);
    expect(indexFromOffset(61, 120)).toBe(1);
    expect(indexFromOffset(240, 120)).toBe(2);
    expect(indexFromOffset(500, 0)).toBe(0);
  });

  test('clampIndex keeps the index in range', () => {
    expect(clampIndex(-1, 3)).toBe(0);
    expect(clampIndex(5, 3)).toBe(2);
    expect(clampIndex(1, 3)).toBe(1);
    expect(clampIndex(4, 0)).toBe(0);
  });

  test('offsetForIndex / centeringPadding', () => {
    expect(offsetForIndex(3, 120)).toBe(360);
    expect(offsetForIndex(-2, 120)).toBe(0);
    expect(centeringPadding(120)).toBe('calc(50% - 60px)');
  });
});

describe('createPickerScrollTracker', () => {
  const width = () => 100;

  test('emits on user scroll when the nearest index changes', () => {
    const t = createPickerScrollTracker(width, 0);
    expect(t.onScroll(40, 5)).toBeNull();
    expect(t.onScroll(60, 5)).toBe(1);
    expect(t.onScroll(110, 5)).toBeNull();
    expect(t.onScroll(210, 5)).toBe(2);
    expect(t.onScrollEnd(200, 5)).toEqual({ index: 2, changed: false });
    // A fling that rests on a new cell without an intermediate scroll event.
    expect(t.onScrollEnd(400, 5)).toEqual({ index: 4, changed: true });
  });

  test('select emits once and swallows the follow-up programmatic scroll', () => {
    const t = createPickerScrollTracker(width, 0);
    expect(t.select(2, 5)).toBe(2);
    expect(t.select(2, 5)).toBeNull();
    // Intermediate scroll events while animating to index 2 are suppressed.
    expect(t.onScroll(100, 5)).toBeNull();
    expect(t.onScroll(200, 5)).toBeNull();
    // Once at rest, normal tracking resumes.
    expect(t.onScroll(300, 5)).toBe(3);
  });

  test('sync ignores echoes of emitted indices and scrolls otherwise', () => {
    const t = createPickerScrollTracker(width, 0);
    expect(t.onScroll(100, 5)).toBe(1);
    // Parent echoes the emitted index -> no scroll.
    expect(t.sync(1, 5, 100)).toBeNull();
    // Parent picks a new index -> scroll target.
    expect(t.sync(3, 5, 100)).toBe(3);
    // scrollend during the programmatic scroll does not re-emit.
    expect(t.onScrollEnd(300, 5)).toBeNull();
    // Already resting at the requested index -> no scroll.
    expect(t.sync(4, 5, 400)).toBeNull();
  });
});
