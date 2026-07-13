import { describe, expect, test } from 'bun:test';

import {
  actionBarBudgetWidth,
  maxIconSlots,
  partitionActionBarItems,
  type ActionBarIconItem,
  type ActionBarItem,
} from './partition-action-bar-items';

const UserIcon = (() => null) as ActionBarIconItem['icon'];
const SettingsIcon = (() => null) as ActionBarIconItem['icon'];
const CodeIcon = (() => null) as ActionBarIconItem['icon'];

const BUTTON_SIZE = 36;
const GAP = 8;
const SLOT_WIDTH = BUTTON_SIZE;
const SLOT = SLOT_WIDTH + GAP;

function item(
  id: string,
  priority = 0,
  overflow: ActionBarItem['overflow'] = 'auto'
): ActionBarItem {
  return {
    id,
    label: id,
    icon: UserIcon,
    onPress: () => {},
    priority,
    overflow,
  };
}

function partition(
  items: ActionBarItem[],
  containerWidth: number,
  reservedWidth = 0,
  slotWidth = SLOT_WIDTH
) {
  return partitionActionBarItems(items, {
    containerWidth,
    buttonSize: BUTTON_SIZE,
    slotWidth,
    gap: GAP,
    reservedWidth,
  });
}

describe('maxIconSlots', () => {
  test('returns zero for non-positive width', () => {
    expect(maxIconSlots(0, SLOT_WIDTH, GAP)).toBe(0);
  });

  test('floors partial slots', () => {
    expect(maxIconSlots(SLOT * 2 + 10, SLOT_WIDTH, GAP)).toBe(2);
  });

  test('uses slot width instead of button size for budget', () => {
    expect(maxIconSlots(120, 60, GAP)).toBe(1);
    expect(maxIconSlots(120, BUTTON_SIZE, GAP)).toBe(2);
  });
});

describe('actionBarBudgetWidth', () => {
  test('subtracts reserved width', () => {
    expect(actionBarBudgetWidth(200, 44)).toBe(156);
  });

  test('never goes negative', () => {
    expect(actionBarBudgetWidth(30, 100)).toBe(0);
  });
});

describe('partitionActionBarItems', () => {
  test('shows all items when budget fits', () => {
    const items = [item('a'), item('b')];
    const result = partition(items, SLOT * 2);
    expect(result.visible.map((i) => i.id)).toEqual(['a', 'b']);
    expect(result.overflow).toHaveLength(0);
  });

  test('keeps inline items visible before first layout pass', () => {
    const items = [
      item('a'),
      item('b'),
      item('menu', 0, 'always'),
    ];
    const result = partition(items, 0);
    expect(result.visible.map((i) => i.id)).toEqual(['a', 'b']);
    expect(result.overflow.map((i) => i.id)).toEqual(['menu']);
  });

  test('overflows everything at zero width when every item is always-overflow', () => {
    const items = [item('a', 0, 'always'), item('b', 0, 'always')];
    const result = partition(items, 0);
    expect(result.visible).toHaveLength(0);
    expect(result.overflow.map((i) => i.id)).toEqual(['a', 'b']);
  });

  test('keeps higher priority items visible', () => {
    const items = [item('low', 1), item('high', 10), item('extra', 0)];
    const result = partition(items, SLOT * 2);
    expect(result.visible.map((i) => i.id)).toEqual(['high']);
    expect(result.overflow.map((i) => i.id)).toEqual(['low', 'extra']);
  });

  test('overflow never keeps always items visible', () => {
    const items = [
      item('visible', 10, 'never'),
      item('menu', 0, 'always'),
    ];
    const result = partition(items, SLOT * 3);
    expect(result.visible.map((i) => i.id)).toEqual(['visible']);
    expect(result.overflow.map((i) => i.id)).toEqual(['menu']);
  });

  test('reserves one slot for the overflow trigger', () => {
    const items = [item('a', 3), item('b', 2), item('c', 1)];
    const result = partition(items, SLOT * 2);
    expect(result.visible).toHaveLength(1);
    expect(result.overflow).toHaveLength(2);
  });

  test('subtracts endSlot reserved width from budget', () => {
    const items = [item('a', 10), item('b', 1), item('c', 0)];
    const result = partition(items, SLOT * 2 + SLOT + GAP, SLOT + GAP);
    expect(result.visible.map((i) => i.id)).toEqual(['a']);
    expect(result.overflow.map((i) => i.id)).toEqual(['b', 'c']);
  });

  test('accepts real icon components', () => {
    const items: ActionBarItem[] = [
      {
        id: 'settings',
        label: 'Settings',
        icon: SettingsIcon,
        onPress: () => {},
      },
      {
        id: 'devtools',
        label: 'Dev',
        icon: CodeIcon,
        onPress: () => {},
        overflow: 'always',
      },
    ];
    const result = partition(items, SLOT * 2);
    expect(result.visible.map((i) => i.id)).toEqual(['settings']);
    expect(result.overflow.map((i) => i.id)).toEqual(['devtools']);
  });

  test('wider slot width reduces visible inline items', () => {
    const items = [
      item('a', 10),
      item('b', 9),
      item('c', 8),
      item('d', 7),
    ];
    const containerWidth = 176;
    const narrow = partition(items, containerWidth);
    const wide = partition(items, containerWidth, 0, 60);
    expect(narrow.visible.length).toBeGreaterThan(wide.visible.length);
  });
});
