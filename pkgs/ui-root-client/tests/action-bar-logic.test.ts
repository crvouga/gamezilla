import { describe, expect, test } from 'bun:test';
import type { ActionBarItem } from '@pkgs/ui-root-client/action-bar-logic';
import {
  actionBarBudgetWidth,
  actionBarHasContent,
  actionBarRowWidth,
  isActionBarAvatarItem,
  partitionActionBarItems,
  partitionTextActions,
  resolveCombinedOverflow,
  screenBaseActionToActionBarItem,
} from '@pkgs/ui-root-client/action-bar-logic';
import type { IconComponent } from '@pkgs/ui-root-client/create-icon';

const Icon = (() => null) as unknown as IconComponent;

function item(
  id: string,
  extra: Partial<Pick<ActionBarItem, 'overflow' | 'priority'>> = {}
): ActionBarItem {
  return { id, label: id, icon: Icon, onClick: () => {}, ...extra };
}

function ids(items: readonly ActionBarItem[]): string[] {
  return items.map((i) => i.id);
}

describe('action-bar budget math', () => {
  test('budget never goes negative; a row is its widths plus the gaps between', () => {
    expect(actionBarBudgetWidth(300, 80)).toBe(220);
    expect(actionBarBudgetWidth(50, 80)).toBe(0);
    expect(actionBarRowWidth([44, 44, 44], 8)).toBe(148);
    expect(actionBarRowWidth([], 8)).toBe(0);
  });
});

describe('partitionActionBarItems', () => {
  const items = [item('a'), item('b'), item('c'), item('d')];

  test('everything fits → no overflow', () => {
    const p = partitionActionBarItems(items, {
      containerWidth: 400,
      buttonSize: 36,
    });
    expect(ids(p.visible)).toEqual(['a', 'b', 'c', 'd']);
    expect(p.overflow).toEqual([]);
  });

  test('before measure keeps auto items inline and always-overflow out', () => {
    const p = partitionActionBarItems(
      [
        item('a'),
        item('b', { overflow: 'always' }),
        item('c', { overflow: 'always' }),
      ],
      { containerWidth: 0, buttonSize: 36 }
    );
    expect(ids(p.visible)).toEqual(['a']);
    expect(ids(p.overflow)).toEqual(['b', 'c']);
  });

  test('reserves a More slot when two or more overflow', () => {
    // 3 slots of 44 stride → fitted overflow = 1 (d). Reserving More gives 2
    // visible + 2 overflow, which is preferred over a singleton menu.
    const p = partitionActionBarItems(items, {
      containerWidth: 3 * 44,
      buttonSize: 36,
      slotWidth: 36,
    });
    expect(ids(p.visible)).toEqual(['a', 'b']);
    expect(ids(p.overflow)).toEqual(['c', 'd']);
  });

  test('priority and never/always policies drive placement', () => {
    const p = partitionActionBarItems(
      [
        item('low', { priority: 0 }),
        item('pinned', { overflow: 'never' }),
        item('high', { priority: 10 }),
        item('hidden', { overflow: 'always' }),
      ],
      // 3 slots: one is reserved for More, leaving pinned + highest priority.
      { containerWidth: 3 * 44, buttonSize: 36, slotWidth: 36 }
    );
    expect(ids(p.visible)).toEqual(['pinned', 'high']);
    expect(ids(p.overflow)).toEqual(['low', 'hidden']);
  });

  test('a budget too small for any item leaves only the More trigger', () => {
    for (const containerWidth of [1, 20, 43, 44, 60]) {
      const p = partitionActionBarItems(
        [item('a', { overflow: 'never' }), item('b', { overflow: 'never' })],
        { containerWidth, buttonSize: 40, slotWidth: 44 }
      );
      expect(p.visible).toEqual([]);
      expect(ids(p.overflow)).toEqual(['a', 'b']);
    }
  });

  test('a lone item that does not fit collapses rather than spilling', () => {
    const p = partitionActionBarItems([item('a')], {
      containerWidth: 30,
      buttonSize: 40,
      slotWidth: 44,
    });
    expect(p.visible).toEqual([]);
    expect(ids(p.overflow)).toEqual(['a']);
  });

  test('measured widths, not slot counts, decide what fits', () => {
    const widths: Record<string, number> = { people: 100, end: 44 };
    const layout = {
      buttonSize: 40,
      slotWidth: 44,
      itemWidth: (i: ActionBarItem) => widths[i.id],
    };
    const items = [
      item('people', { overflow: 'never', priority: 90 }),
      item('end', { overflow: 'never', priority: 95 }),
      item('share', { overflow: 'always' }),
      item('leave', { overflow: 'always' }),
    ];
    // people 100 + end 44 + More 44 + gaps 16 = 204.
    expect(
      ids(
        partitionActionBarItems(items, { ...layout, containerWidth: 204 })
          .visible
      )
    ).toEqual(['people', 'end']);
    // One px short: End no longer fits beside the 100px pill and More.
    const short = partitionActionBarItems(items, {
      ...layout,
      containerWidth: 203,
    });
    expect(ids(short.visible)).toEqual(['people']);
    expect(ids(short.overflow)).toEqual(['end', 'share', 'leave']);
    // Too narrow for the pill beside More: More alone.
    const tiny = partitionActionBarItems(items, {
      ...layout,
      containerWidth: 151,
    });
    expect(tiny.visible).toEqual([]);
  });

  test('every inline row fits its budget, More included', () => {
    const many = Array.from({ length: 6 }, (_, i) =>
      item(`i${i}`, { priority: i })
    );
    for (let width = 1; width <= 400; width += 1) {
      const p = partitionActionBarItems(many, {
        containerWidth: width,
        buttonSize: 40,
        slotWidth: 44,
      });
      const slots = p.visible.length + (p.overflow.length > 0 ? 1 : 0);
      const row = actionBarRowWidth(new Array(slots).fill(44), 8);
      expect(p.visible.length === 0 || row <= width).toBe(true);
    }
  });

  test('empty input is a no-op', () => {
    expect(
      partitionActionBarItems([], { containerWidth: 100, buttonSize: 36 })
    ).toEqual({ visible: [], overflow: [] });
  });
});

describe('text actions + combined overflow', () => {
  test('partitionTextActions honours always/never modes', () => {
    const actions = [
      { id: 't1', label: 'One', onClick: () => {} },
      {
        id: 't2',
        label: 'Two',
        onClick: () => {},
        overflow: 'always' as const,
      },
    ];
    expect(
      partitionTextActions(actions, 'auto').overflow.map((a) => a.id)
    ).toEqual(['t2']);
    expect(partitionTextActions(actions, 'never').overflow).toEqual([]);
  });

  test('a lone text action is pulled back inline; icon overflow is kept', () => {
    const icons = { visible: [item('a')], overflow: [item('b')] };
    const combined = resolveCombinedOverflow(icons, {
      inline: [],
      overflow: [],
    });
    expect(ids(combined.partition.visible)).toEqual(['a']);
    expect(ids(combined.partition.overflow)).toEqual(['b']);

    const text = resolveCombinedOverflow(
      { visible: [], overflow: [] },
      { inline: [], overflow: [{ id: 't', label: 'T', onClick: () => {} }] }
    );
    expect(text.inlineText.map((a) => a.id)).toEqual(['t']);
    expect(text.overflowText).toEqual([]);
  });
});

describe('adapters', () => {
  test('isActionBarAvatarItem / screenBaseActionToActionBarItem', () => {
    expect(isActionBarAvatarItem(item('a'))).toBe(false);
    expect(
      isActionBarAvatarItem({
        id: 'me',
        label: 'Me',
        variant: 'avatar',
        children: null,
        onClick: () => {},
      })
    ).toBe(true);
    const onClick = (): void => {};
    expect(
      screenBaseActionToActionBarItem(
        { label: 'Share', onClick, icon: Icon },
        'share'
      )
    ).toMatchObject({ id: 'share', label: 'Share', icon: Icon, onClick });
    expect(
      screenBaseActionToActionBarItem({ label: 'x', onClick }, 'x')
    ).toBeNull();
  });

  test('actionBarHasContent', () => {
    expect(
      actionBarHasContent({
        itemCount: 0,
        inlineTextCount: 0,
        overflowCount: 0,
        hasEndSlot: false,
      })
    ).toBe(false);
    expect(
      actionBarHasContent({
        itemCount: 0,
        inlineTextCount: 0,
        overflowCount: 0,
        hasEndSlot: true,
      })
    ).toBe(true);
  });
});
