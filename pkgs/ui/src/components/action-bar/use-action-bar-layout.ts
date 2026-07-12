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
  gap: number;
  onMenuClose: () => void;
}): ActionBarLayoutState {
  const [containerWidth, setContainerWidth] = useState(0);
  const [endSlotWidth, setEndSlotWidth] = useState(0);

  const { inline: inlineTextActions, overflow: overflowTextActions } = useMemo(
    () => partitionTextActions(args.textActions),
    [args.textActions]
  );

  const onContainerLayout = useCallback((event: LayoutChangeEvent) => {
    const next = Math.floor(event.nativeEvent.layout.width);
    setContainerWidth((prev) => (prev === next ? prev : next));
  }, []);

  const onEndSlotLayout = useCallback((event: LayoutChangeEvent) => {
    const next = Math.floor(event.nativeEvent.layout.width);
    setEndSlotWidth((prev) => (prev === next ? prev : next));
  }, []);

  const reservedWidth = useMemo(() => {
    if (args.endSlot === undefined || args.endSlot === null) return 0;
    return endSlotWidth > 0 ? endSlotWidth + args.gap : 0;
  }, [args.endSlot, endSlotWidth, args.gap]);

  const partition = useMemo(
    () =>
      partitionActionBarItems(args.items, {
        containerWidth,
        buttonSize: args.buttonSize,
        gap: args.gap,
        reservedWidth,
      }),
    [args.items, containerWidth, args.buttonSize, args.gap, reservedWidth]
  );

  const overflowItemActions = useMemo(
    () => actionBarItemsToOverflowActions(partition.overflow, args.onMenuClose),
    [partition.overflow, args.onMenuClose]
  );

  return {
    containerWidth,
    endSlotWidth,
    onContainerLayout,
    onEndSlotLayout,
    reservedWidth,
    partition,
    inlineTextActions,
    overflowTextActions,
    overflowItemActions,
  };
}
