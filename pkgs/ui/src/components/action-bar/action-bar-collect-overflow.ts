import type { OverflowMenuAction } from '../overflow-menu-button/overflow-menu-button';
import { textActionsToOverflow } from './action-bar-parts';
import type {
  ActionBarOverflowMode,
  ActionBarTextAction,
} from './action-bar-types';

export function collectOverflowActions(args: {
  overflow: ActionBarOverflowMode;
  overflowItemActions: OverflowMenuAction[];
  overflowTextActions: readonly ActionBarTextAction[];
  onClose: () => void;
}): OverflowMenuAction[] {
  if (args.overflow === 'never') return [];
  return [
    ...args.overflowItemActions,
    ...textActionsToOverflow(args.overflowTextActions, args.onClose),
  ];
}
