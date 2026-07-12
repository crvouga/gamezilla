import type { ReactNode } from 'react';

import type { IconComponent } from '../icons';

type ActionBarItemBase = {
  id: string;
  label: ReactNode;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  endsGroup?: boolean;
  /** Higher values stay visible longer when space is tight. */
  priority?: number;
  overflow?: 'auto' | 'always' | 'never';
};

export type ActionBarIconItem = ActionBarItemBase & {
  variant?: 'icon';
  icon: IconComponent;
};

export type ActionBarAvatarItem = ActionBarItemBase & {
  variant: 'avatar';
  children: ReactNode;
};

export type ActionBarItem = ActionBarIconItem | ActionBarAvatarItem;

export type ActionBarPartition = {
  visible: ActionBarItem[];
  overflow: ActionBarItem[];
};

export type PartitionActionBarLayout = {
  containerWidth: number;
  buttonSize: number;
  gap?: number;
  reservedWidth?: number;
};

const DEFAULT_GAP = 8;

export function isActionBarAvatarItem(
  item: ActionBarItem
): item is ActionBarAvatarItem {
  return item.variant === 'avatar';
}

function itemSets(items: readonly ActionBarItem[]): {
  always: Set<string>;
  never: Set<string>;
} {
  const always = new Set<string>();
  const never = new Set<string>();
  for (const item of items) {
    if (item.overflow === 'always') always.add(item.id);
    if (item.overflow === 'never') never.add(item.id);
  }
  return { always, never };
}

type AssignmentState = {
  visibleIds: Set<string>;
  overflowIds: Set<string>;
  maxVisible: number;
};

function placeItem(itemId: string, state: AssignmentState): void {
  if (state.visibleIds.size < state.maxVisible) state.visibleIds.add(itemId);
  else state.overflowIds.add(itemId);
}

function assignNeverItems(
  items: readonly ActionBarItem[],
  never: Set<string>,
  always: Set<string>,
  state: AssignmentState
): void {
  for (const item of items) {
    if (!never.has(item.id) || always.has(item.id)) continue;
    placeItem(item.id, state);
  }
}

function assignAutoItems(
  items: readonly ActionBarItem[],
  never: Set<string>,
  always: Set<string>,
  state: AssignmentState
): void {
  const autoItems = items.filter(
    (item) => !never.has(item.id) && !always.has(item.id)
  );
  const autoByPriority = [...autoItems].sort(
    (a, b) => (b.priority ?? 0) - (a.priority ?? 0)
  );
  for (const item of autoByPriority) {
    if (state.visibleIds.has(item.id) || state.overflowIds.has(item.id)) continue;
    placeItem(item.id, state);
  }
}

function assignRemainingItems(
  items: readonly ActionBarItem[],
  state: AssignmentState
): void {
  for (const item of items) {
    if (state.visibleIds.has(item.id) || state.overflowIds.has(item.id)) continue;
    placeItem(item.id, state);
  }
}

function pickVisibleIds(
  items: readonly ActionBarItem[],
  maxVisible: number,
  always: Set<string>,
  never: Set<string>
): { visibleIds: Set<string>; overflowIds: Set<string> } {
  const state: AssignmentState = {
    visibleIds: new Set<string>(),
    overflowIds: new Set<string>(always),
    maxVisible,
  };
  assignNeverItems(items, never, always, state);
  assignAutoItems(items, never, always, state);
  assignRemainingItems(items, state);
  return { visibleIds: state.visibleIds, overflowIds: state.overflowIds };
}

function partitionByVisibleCount(
  items: readonly ActionBarItem[],
  maxVisible: number
): ActionBarPartition {
  if (maxVisible <= 0) {
    return { visible: [], overflow: [...items] };
  }

  const { always, never } = itemSets(items);
  const { visibleIds, overflowIds } = pickVisibleIds(
    items,
    maxVisible,
    always,
    never
  );

  return {
    visible: items.filter((item) => visibleIds.has(item.id)),
    overflow: items.filter((item) => overflowIds.has(item.id)),
  };
}

export function maxIconSlots(
  availableWidth: number,
  buttonSize: number,
  gap: number = DEFAULT_GAP
): number {
  const slotWidth = buttonSize + gap;
  if (slotWidth <= 0) return 0;
  return Math.floor(availableWidth / slotWidth);
}

/** Width left for icon slots after reserving fixed trailing chrome. */
export function actionBarBudgetWidth(
  containerWidth: number,
  reservedWidth: number
): number {
  return Math.max(0, containerWidth - reservedWidth);
}

export function partitionActionBarItems(
  items: readonly ActionBarItem[],
  layout: PartitionActionBarLayout
): ActionBarPartition {
  const gap = layout.gap ?? DEFAULT_GAP;
  const reservedWidth = layout.reservedWidth ?? 0;
  const budget = actionBarBudgetWidth(layout.containerWidth, reservedWidth);
  const slots = maxIconSlots(budget, layout.buttonSize, gap);
  if (items.length === 0) {
    return { visible: [], overflow: [] };
  }

  let partition = partitionByVisibleCount(items, slots);
  if (partition.overflow.length > 0 && slots > 0) {
    partition = partitionByVisibleCount(items, slots - 1);
  }
  return partition;
}

export type ScreenBaseActionLike = {
  label: ReactNode;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  icon?: IconComponent;
  endsGroup?: boolean;
  overflow?: 'auto' | 'always' | 'never';
};

export function screenBaseActionToActionBarItem(
  action: ScreenBaseActionLike,
  id: string
): ActionBarItem | null {
  if (action.icon === undefined) return null;
  return {
    id,
    label: action.label,
    icon: action.icon,
    onPress: action.onPress,
    ...(action.disabled !== undefined ? { disabled: action.disabled } : {}),
    ...(action.loading !== undefined ? { loading: action.loading } : {}),
    ...(action.endsGroup !== undefined ? { endsGroup: action.endsGroup } : {}),
    ...(action.overflow !== undefined ? { overflow: action.overflow } : {}),
  };
}
