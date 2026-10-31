/**
 * Adapters from `ActionBar` items / text actions to `OverflowMenuAction`s
 * (the row shape consumed by `OverflowMenuButton` / `FloatingMenu`).
 */

import type {
  ActionBarItem,
  ActionBarOverflowMode,
  ActionBarTextAction,
} from './action-bar-logic';
import { isActionBarAvatarItem } from './action-bar-logic';
import { EllipsisIcon } from './icons';
import type { OverflowMenuAction } from './overflow-menu-button/index';

export function actionBarItemToOverflowAction(
  item: ActionBarItem,
  onClose: () => void
): OverflowMenuAction {
  const ariaLabel =
    item['aria-label'] ??
    (typeof item.label === 'string' ? item.label : undefined);
  return {
    id: item.id,
    label: item.label,
    icon: isActionBarAvatarItem(item) ? EllipsisIcon : item.icon,
    onClick: () => {
      onClose();
      item.onClick();
    },
    subtitle: item.subtitle,
    disabled:
      item.disabled === true || item.loading === true ? true : undefined,
    endsGroup: item.endsGroup === true ? true : undefined,
    trailing: item.trailing,
    leading: isActionBarAvatarItem(item) ? item.children : undefined,
    'aria-label': ariaLabel,
    dataSet: item.dataSet,
  };
}

export function textActionsToOverflow(
  actions: readonly ActionBarTextAction[],
  onClose: () => void
): OverflowMenuAction[] {
  return actions.map((action) => ({
    id: action.id,
    label: action.label,
    icon: EllipsisIcon,
    onClick: () => {
      onClose();
      action.onClick();
    },
    disabled: action.disabled,
    dataSet: action.dataSet,
  }));
}

export function collectOverflowActions(args: {
  overflow: ActionBarOverflowMode;
  overflowItems: readonly ActionBarItem[];
  overflowTextActions: readonly ActionBarTextAction[];
  onClose: () => void;
}): OverflowMenuAction[] {
  if (args.overflow === 'never') return [];
  return [
    ...args.overflowItems.map((item) =>
      actionBarItemToOverflowAction(item, args.onClose)
    ),
    ...textActionsToOverflow(args.overflowTextActions, args.onClose),
  ];
}
