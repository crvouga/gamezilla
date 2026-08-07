import { useMemo } from 'react';

import type {
  FloatingMenuContent,
  FloatingMenuHeaderSpec,
} from '../floating-menu';
import { useAnchoredMenu } from '../overflow-menu-button/use-anchored-menu';
import { collectOverflowActions } from './action-bar-collect-overflow';
import { buildOverflowMenuContent } from './action-bar-parts';
import type {
  ActionBarOverflowMode,
  ActionBarTextAction,
} from './action-bar-types';
import type { ActionBarItem } from './partition-action-bar-items';
import { useActionBarLayout } from './use-action-bar-layout';

export function useActionBarController(args: {
  items: readonly ActionBarItem[];
  textActions: readonly ActionBarTextAction[];
  endSlot: unknown;
  buttonSize: number;
  slotWidth: number;
  gap: number;
  overflow: ActionBarOverflowMode;
  overflowMenuHeader?: FloatingMenuHeaderSpec;
}) {
  const menu = useAnchoredMenu();
  const layout = useActionBarLayout({
    items: args.items,
    textActions: args.textActions,
    endSlot: args.endSlot,
    buttonSize: args.buttonSize,
    slotWidth: args.slotWidth,
    gap: args.gap,
    overflow: args.overflow,
    onMenuClose: menu.close,
  });

  const overflowActions = useMemo(
    () =>
      collectOverflowActions({
        overflow: args.overflow,
        overflowItemActions: layout.overflowItemActions,
        overflowTextActions: layout.overflowTextActions,
        onClose: menu.close,
      }),
    [
      args.overflow,
      layout.overflowItemActions,
      layout.overflowTextActions,
      menu.close,
    ]
  );

  const menuContent = useMemo(
    (): FloatingMenuContent =>
      buildOverflowMenuContent(overflowActions, args.overflowMenuHeader),
    [overflowActions, args.overflowMenuHeader]
  );

  return { menu, layout, overflowActions, menuContent };
}
