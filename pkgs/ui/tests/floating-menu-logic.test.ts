import {
  computeFloatingMenuPosition,
  estimateFloatingMenuHeight,
  type FloatingMenuContent,
  nextMenuItemIndex,
} from '@pkgs/ui/components/floating-menu';
import { SettingsIcon } from '@pkgs/ui/components/icons';
import { describe, expect, test } from 'vitest';

const viewport = { width: 1000, height: 800 };
const insets = { top: 0, bottom: 0 };

describe('computeFloatingMenuPosition', () => {
  test('opens below the anchor, right-aligned to it', () => {
    expect(
      computeFloatingMenuPosition({
        anchor: { x: 500, y: 20, width: 40, height: 40 },
        menuHeight: 200,
        menuWidth: 260,
        insets,
        viewport,
      })
    ).toEqual({ top: 66, left: 280 });
  });

  test('flips above when there is no room below and clamps to the edges', () => {
    expect(
      computeFloatingMenuPosition({
        anchor: { x: 10, y: 700, width: 40, height: 40 },
        menuHeight: 200,
        menuWidth: 260,
        insets: { top: 20, bottom: 30 },
        viewport,
      })
    ).toEqual({ top: 494, left: 8 });
    // Far right anchor clamps to viewport - width - margin.
    expect(
      computeFloatingMenuPosition({
        anchor: { x: 990, y: 0, width: 40, height: 40 },
        menuHeight: 100,
        menuWidth: 260,
        insets,
        viewport,
        gap: 0,
      })
    ).toEqual({ top: 40, left: 732 });
  });

  test('never goes above the top inset', () => {
    expect(
      computeFloatingMenuPosition({
        anchor: { x: 0, y: 790, width: 10, height: 10 },
        menuHeight: 900,
        menuWidth: 100,
        insets: { top: 44, bottom: 0 },
        viewport,
      }).top
    ).toBe(52);
  });
});

describe('estimateFloatingMenuHeight', () => {
  test('sums panel inset, header, items (with subtitles) and dividers', () => {
    const rows: FloatingMenuContent['rows'] = [
      { type: 'item', id: 'a', label: 'A', icon: SettingsIcon },
      { type: 'divider', id: 'd' },
      {
        type: 'item',
        id: 'b',
        label: 'B',
        subtitle: 'b@x',
        icon: SettingsIcon,
      },
    ];
    expect(estimateFloatingMenuHeight({ rows })).toBe(16 + 48 + 10 + 64);
    expect(estimateFloatingMenuHeight({ header: { title: 'T' }, rows })).toBe(
      16 + 64 + 48 + 10 + 64
    );
    expect(
      estimateFloatingMenuHeight({
        header: { title: 'T', avatar: 'av' },
        rows: [],
      })
    ).toBe(16 + 72);
  });
});

describe('nextMenuItemIndex', () => {
  test('arrows wrap, Home/End jump, other keys are ignored', () => {
    const count = 3;
    expect(nextMenuItemIndex({ key: 'ArrowDown', current: -1, count })).toBe(0);
    expect(nextMenuItemIndex({ key: 'ArrowDown', current: 0, count })).toBe(1);
    expect(nextMenuItemIndex({ key: 'ArrowDown', current: 2, count })).toBe(0);
    expect(nextMenuItemIndex({ key: 'ArrowUp', current: -1, count })).toBe(2);
    expect(nextMenuItemIndex({ key: 'ArrowUp', current: 0, count })).toBe(2);
    expect(nextMenuItemIndex({ key: 'ArrowUp', current: 2, count })).toBe(1);
    expect(nextMenuItemIndex({ key: 'Home', current: 2, count })).toBe(0);
    expect(nextMenuItemIndex({ key: 'End', current: 0, count })).toBe(2);
    expect(nextMenuItemIndex({ key: 'Tab', current: 0, count })).toBeNull();
    expect(nextMenuItemIndex({ key: 'ArrowDown', current: 0, count: 0 })).toBe(
      null
    );
  });
});
