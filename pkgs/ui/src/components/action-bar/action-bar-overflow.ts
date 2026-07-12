import type { LocalizedString } from '@pkgs/i18n';

import { EllipsisIcon } from '../icons';
import type { OverflowMenuAction } from '../overflow-menu-button/overflow-menu-button';
import {
  isActionBarAvatarItem,
  type ActionBarItem,
} from './partition-action-bar-items';

export function actionBarItemToOverflowAction(
  item: ActionBarItem,
  onClose: () => void
): OverflowMenuAction {
  const icon = isActionBarAvatarItem(item) ? EllipsisIcon : item.icon;
  const action: OverflowMenuAction = {
    id: item.id,
    label: item.label,
    icon,
    onPress: () => {
      onClose();
      item.onPress();
    },
    ...(item.disabled !== undefined ? { disabled: item.disabled } : {}),
    ...(item.endsGroup === true ? { endsGroup: true } : {}),
  };
  if (typeof item.label === 'string') {
    action.accessibilityLabel = item.label as LocalizedString;
  }
  return action;
}

export function actionBarItemsToOverflowActions(
  items: readonly ActionBarItem[],
  onClose: () => void
): OverflowMenuAction[] {
  return items.map((item) => actionBarItemToOverflowAction(item, onClose));
}
