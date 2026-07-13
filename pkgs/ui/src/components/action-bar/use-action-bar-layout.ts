import { useCallback, useMemo, useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';

import { actionBarItemsToOverflowActions } from './action-bar-overflow';
import type { ActionBarTextAction } from './action-bar-types';
import {
  partitionActionBarItems,
  type ActionBarItem,
  type ActionBarPartition,
} from './partition-action-bar-items';

function partitionTextActions(actions: readonly ActionBarTextAction[]): {
  inline: ActionBarTextAction[];
  overflow: ActionBarTextAction[];
} {
  const inline: ActionBarTextAction[] = [];
  const overflow: ActionBarTextAction[] = [];
  for (const action of actions) {
    if (action.overflow === 'always') overflow.push(action);
    else inline.push(action);
  }
  return { inline, overflow };
}

function useFloorLayoutWidth(): {
  width: number;
  onLayout: (event: LayoutChangeEvent) => void;
} {
  const [width, setWidth] = useState(0);
  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const next = Math.floor(event.nativeEvent.layout.width);
    setWidth((prev) => (prev === next ? prev : next));
  }, []);
  return { width, onLayout };
}

export type ActionBarLayoutState = {
  containerWidth: number;
  endSlotWidth: number;
  onContainerLayout: (event: LayoutChangeEvent) => void;
  onEndSlotLayout: (event: LayoutChangeEvent) => void;
  reservedWidth: number;
  partition: ActionBarPartition;
  inlineTextActions: ActionBarTextAction[];
  overflowTextActions: ActionBarTextAction[];
  overflowItemActions: ReturnType<typeof actionBarItemsToOverflowActions>;
};

export function useActionBarLayout(args: {
  items: readonly ActionBarItem[];
  textActions: readonly ActionBarTextAction[];
  endSlot: unknown;
  buttonSize: number;
  slotWidth: number;
  gap: number;
  /** When `'never'`, every item stays inline — no overflow menu. */
  overflow?: 'auto' | 'never';
  onMenuClose: () => void;
}): ActionBarLayoutState {
  const container = useFloorLayoutWidth();
  const endSlot = useFloorLayoutWidth();
  const overflowMode = args.overflow ?? 'auto';

  const { inline: inlineTextActions, overflow: overflowTextActions } = useMemo(
    () =>
      overflowMode === 'never'
        ? {
            inline: [...args.textActions],
            overflow: [] as ActionBarTextAction[],
          }
        : partitionTextActions(args.textActions),
    [args.textActions, overflowMode]
  );

  const reservedWidth = useMemo(() => {
    if (args.endSlot === undefined || args.endSlot === null) return 0;
    return endSlot.width > 0 ? endSlot.width + args.gap : 0;
  }, [args.endSlot, endSlot.width, args.gap]);

  const partition = useMemo((): ActionBarPartition => {
    if (overflowMode === 'never') {
      return { visible: [...args.items], overflow: [] };
    }
    return partitionActionBarItems(args.items, {
      containerWidth: container.width,
      buttonSize: args.buttonSize,
      slotWidth: args.slotWidth,
      gap: args.gap,
      reservedWidth,
    });
  }, [
    overflowMode,
    args.items,
    container.width,
    args.buttonSize,
    args.slotWidth,
    args.gap,
    reservedWidth,
  ]);

  const overflowItemActions = useMemo(
    () => actionBarItemsToOverflowActions(partition.overflow, args.onMenuClose),
    [partition.overflow, args.onMenuClose]
  );

  return {
    containerWidth: container.width,
    endSlotWidth: endSlot.width,
    onContainerLayout: container.onLayout,
    onEndSlotLayout: endSlot.onLayout,
    reservedWidth,
    partition,
    inlineTextActions,
    overflowTextActions,
    overflowItemActions,
  };
}
