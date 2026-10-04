import { describe, expect, test } from 'bun:test';
import { computeFloatingMenuPosition } from '@pkgs/ui-client/floating-menu-position';
import { estimateFloatingMenuHeight } from '@pkgs/ui-client/floating-menu-estimate-height';
import type { FloatingMenuContent } from '@pkgs/ui-client/floating-menu-content';
import { nextMenuItemIndex } from '@pkgs/ui-shared/floating-menu-keyboard';
import { SettingsIcon } from '@pkgs/ui-client/icons';

const viewport = { width: 1000, height: 800 };
const insets = { top: 0, bottom: 0 };

describe('computeFloatingMenuPosition', () => {
  test('opens below the anchor, right-aligned (bottom-end)', () => {
    expect(
      computeFloatingMenuPosition({
        anchor: { x: 500, y: 20, width: 40, height: 40 },
        menuHeight: 200,
        menuWidth: 260,
        insets,
        viewport,
        placement: 'bottom-end',
      })
    ).toEqual({ top: 66, left: 280 });
  });

  test('honors bottom-start and top-end without flipping', () => {
    expect(
      computeFloatingMenuPosition({
        anchor: { x: 100, y: 20, width: 40, height: 40 },
        menuHeight: 200,
        menuWidth: 260,
        insets,
        viewport,
        placement: 'bottom-start',
      })
    ).toEqual({ top: 66, left: 100 });
    expect(
      computeFloatingMenuPosition({
        anchor: { x: 500, y: 700, width: 40, height: 40 },
        menuHeight: 200,
        menuWidth: 260,
        insets,
        viewport,
        placement: 'top-end',
      })
    ).toEqual({ top: 494, left: 280 });
  });

  test('clamps to edges when placement would overflow', () => {
    expect(
      computeFloatingMenuPosition({
        anchor: { x: 10, y: 700, width: 40, height: 40 },
        menuHeight: 200,
        menuWidth: 260,
        insets: { top: 20, bottom: 30 },
        viewport,
        placement: 'bottom-end',
      })
    ).toEqual({ top: 562, left: 8 });
    // Far right anchor clamps to viewport - width - margin.
    expect(
      computeFloatingMenuPosition({
        anchor: { x: 990, y: 0, width: 40, height: 40 },
        menuHeight: 100,
        menuWidth: 260,
        insets,
        viewport,
        gap: 0,
        placement: 'bottom-end',
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
        placement: 'top-end',
      }).top
    ).toBe(52);
  });
});

describe('estimateFloatingMenuHeight', () => {
  test('sums panel inset, header, items and dividers (subtitle is trailing)', () => {
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
    // Subtitle no longer adds height — same single-line row as plain items.
    expect(estimateFloatingMenuHeight({ rows })).toBe(16 + 44 + 10 + 44);
    expect(estimateFloatingMenuHeight({ header: { title: 'T' }, rows })).toBe(
      16 + 64 + 44 + 10 + 44
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
