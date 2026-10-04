import { describe, expect, test } from 'bun:test';
import type { ActionBarItem } from '@pkgs/ui-client/action-bar-logic';
import { actionBarBudgetWidth, actionBarHasContent, isActionBarAvatarItem, maxIconSlots, partitionActionBarItems, partitionTextActions, resolveCombinedOverflow, screenBaseActionToActionBarItem } from '@pkgs/ui-client/action-bar-logic';
import type { IconComponent } from '@pkgs/ui-client/create-icon';

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
  test('budget never goes negative and slots floor by stride', () => {
    expect(actionBarBudgetWidth(300, 80)).toBe(220);
    expect(actionBarBudgetWidth(50, 80)).toBe(0);
    expect(maxIconSlots(220, 36, 8)).toBe(5);
    expect(maxIconSlots(43, 36, 8)).toBe(0);
    expect(maxIconSlots(100, 0, 0)).toBe(0);
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

  test('a lone overflow item is pulled back inline', () => {
    const icons = { visible: [item('a')], overflow: [item('b')] };
    const combined = resolveCombinedOverflow(icons, {
      inline: [],
      overflow: [],
    });
    expect(ids(combined.partition.visible)).toEqual(['a', 'b']);
    expect(combined.partition.overflow).toEqual([]);

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
