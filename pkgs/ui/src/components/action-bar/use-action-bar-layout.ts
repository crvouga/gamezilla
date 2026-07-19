import { useCallback, useMemo, useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';

import { actionBarItemsToOverflowActions } from './action-bar-overflow';
import type { ActionBarTextAction } from './action-bar-types';
import {
  partitionActionBarItems,
  type ActionBarItem,
  type ActionBarPartition,
} from './partition-action-bar-items';

function partitionTextActions(
  actions: readonly ActionBarTextAction[],
  overflowMode: 'auto' | 'never'
): { inline: ActionBarTextAction[]; overflow: ActionBarTextAction[] } {
  if (overflowMode === 'never') {
    return { inline: [...actions], overflow: [] };
  }
  const inline: ActionBarTextAction[] = [];
  const overflow: ActionBarTextAction[] = [];
  for (const action of actions) {
    if (action.overflow === 'always') overflow.push(action);
    else inline.push(action);
  }
  return { inline, overflow };
}

/** Expand a combined one-item overflow so More never holds a single action. */
function resolveCombinedOverflow(args: {
  iconPartition: ActionBarPartition;
  inlineText: readonly ActionBarTextAction[];
  overflowText: readonly ActionBarTextAction[];
}): {
  partition: ActionBarPartition;
  inlineText: ActionBarTextAction[];
  overflowText: ActionBarTextAction[];
} {
  const total = args.iconPartition.overflow.length + args.overflowText.length;
  if (total !== 1) {
    return {
      partition: args.iconPartition,
      inlineText: [...args.inlineText],
      overflowText: [...args.overflowText],
    };
  }
  if (args.iconPartition.overflow.length === 1) {
    return {
      partition: {
        visible: [
          ...args.iconPartition.visible,
          ...args.iconPartition.overflow,
        ],
        overflow: [],
      },
      inlineText: [...args.inlineText],
      overflowText: [],
    };
  }
  return {
    partition: args.iconPartition,
    inlineText: [...args.inlineText, ...args.overflowText],
    overflowText: [],
  };
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

function resolveIconPartition(args: {
  overflowMode: 'auto' | 'never';
  items: readonly ActionBarItem[];
  containerWidth: number;
  buttonSize: number;
  slotWidth: number;
  gap: number;
  reservedWidth: number;
}): ActionBarPartition {
  if (args.overflowMode === 'never') {
    return { visible: [...args.items], overflow: [] };
  }
  return partitionActionBarItems(args.items, {
    containerWidth: args.containerWidth,
    buttonSize: args.buttonSize,
    slotWidth: args.slotWidth,
    gap: args.gap,
    reservedWidth: args.reservedWidth,
  });
}

function useActionBarPartitions(args: {
  items: readonly ActionBarItem[];
  textActions: readonly ActionBarTextAction[];
  overflowMode: 'auto' | 'never';
  containerWidth: number;
  buttonSize: number;
  slotWidth: number;
  gap: number;
  reservedWidth: number;
  onMenuClose: () => void;
}) {
  const textPartition = useMemo(
    () => partitionTextActions(args.textActions, args.overflowMode),
    [args.textActions, args.overflowMode]
  );
  const iconPartition = useMemo(
    () =>
      resolveIconPartition({
        overflowMode: args.overflowMode,
        items: args.items,
        containerWidth: args.containerWidth,
        buttonSize: args.buttonSize,
        slotWidth: args.slotWidth,
        gap: args.gap,
        reservedWidth: args.reservedWidth,
      }),
    [
      args.overflowMode,
      args.items,
      args.containerWidth,
      args.buttonSize,
      args.slotWidth,
      args.gap,
      args.reservedWidth,
    ]
  );
  const combined = useMemo(
    () =>
      resolveCombinedOverflow({
        iconPartition,
        inlineText: textPartition.inline,
        overflowText: textPartition.overflow,
      }),
    [iconPartition, textPartition]
  );
  const overflowItemActions = useMemo(
    () =>
      actionBarItemsToOverflowActions(
        combined.partition.overflow,
        args.onMenuClose
      ),
    [combined.partition.overflow, args.onMenuClose]
  );
  return { combined, overflowItemActions };
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
  const reservedWidth = useMemo(() => {
    if (args.endSlot === undefined || args.endSlot === null) return 0;
    return endSlot.width > 0 ? endSlot.width + args.gap : 0;
  }, [args.endSlot, endSlot.width, args.gap]);
  const { combined, overflowItemActions } = useActionBarPartitions({
    items: args.items,
    textActions: args.textActions,
    overflowMode,
    containerWidth: container.width,
    buttonSize: args.buttonSize,
    slotWidth: args.slotWidth,
    gap: args.gap,
    reservedWidth,
    onMenuClose: args.onMenuClose,
  });
  return {
    containerWidth: container.width,
    endSlotWidth: endSlot.width,
    onContainerLayout: container.onLayout,
    onEndSlotLayout: endSlot.onLayout,
    reservedWidth,
    partition: combined.partition,
    inlineTextActions: combined.inlineText,
    overflowTextActions: combined.overflowText,
    overflowItemActions,
  };
}
