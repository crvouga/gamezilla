/**
 * Framework-free layout logic for `ActionBar`: which items fit inline, which
 * collapse into the More menu, and the adapter from `ScreenBase`-style
 * actions. No Solid imports at runtime (types only) so it unit-tests bare.
 */

import type { JSX } from 'solid-js';
import type { IconComponent } from '../icons';

export type ActionBarAlign = 'start' | 'end';

export type ActionBarOverflowMode = 'auto' | 'never';

export type ActionBarOverflowPolicy = 'auto' | 'always' | 'never';

export type ActionBarTextAction = {
  id: string;
  label: JSX.Element;
  onClick: () => void;
  intent?: 'primary' | 'danger' | 'neutral' | undefined;
  loading?: boolean | undefined;
  disabled?: boolean | undefined;
  overflow?: ActionBarOverflowPolicy | undefined;
};

export type ActionBarPressFeedback = {
  successLabel: JSX.Element;
  successIcon?: IconComponent | undefined;
  resetMs?: number | undefined;
};

type ActionBarItemBase = {
  id: string;
  label: JSX.Element;
  /** Secondary line under the label in the overflow menu (e.g. email). */
  subtitle?: JSX.Element | undefined;
  /** Compact caption when inline labels are shown; defaults to `label`. */
  shortLabel?: JSX.Element | undefined;
  onClick: () => void;
  disabled?: boolean | undefined;
  loading?: boolean | undefined;
  endsGroup?: boolean | undefined;
  /** Higher values stay visible longer when space is tight. */
  priority?: number | undefined;
  overflow?: ActionBarOverflowPolicy | undefined;
  pressFeedback?: ActionBarPressFeedback | undefined;
  /** Optional trailing affordance in the overflow menu (e.g. checkmark). */
  trailing?: JSX.Element | undefined;
  /** Overflow-menu a11y label; defaults to string `label` when omitted. */
  'aria-label'?: string | undefined;
  dataSet?: Record<string, string> | undefined;
};

export type ActionBarIconItem = ActionBarItemBase & {
  variant?: 'icon' | undefined;
  icon: IconComponent;
};

export type ActionBarAvatarItem = ActionBarItemBase & {
  variant: 'avatar';
  children: JSX.Element;
};

export type ActionBarItem = ActionBarIconItem | ActionBarAvatarItem;

export type ActionBarPartition = {
  visible: ActionBarItem[];
  overflow: ActionBarItem[];
};

export type PartitionActionBarLayout = {
  containerWidth: number;
  buttonSize: number;
  /** Horizontal budget per inline slot; defaults to `buttonSize`. */
  slotWidth?: number | undefined;
  gap?: number | undefined;
  reservedWidth?: number | undefined;
};

export const ACTION_BAR_DEFAULT_GAP = 8;

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

function isPlaced(id: string, state: AssignmentState): boolean {
  return state.visibleIds.has(id) || state.overflowIds.has(id);
}

function pickVisibleIds(
  items: readonly ActionBarItem[],
  maxVisible: number,
  sets: { always: Set<string>; never: Set<string> }
): { visibleIds: Set<string>; overflowIds: Set<string> } {
  const state: AssignmentState = {
    visibleIds: new Set<string>(),
    overflowIds: new Set<string>(sets.always),
    maxVisible,
  };
  // 1. `never` items claim slots first.
  for (const item of items) {
    if (sets.never.has(item.id) && !sets.always.has(item.id)) {
      placeItem(item.id, state);
    }
  }
  // 2. `auto` items by descending priority.
  const auto = items.filter(
    (item) => !sets.never.has(item.id) && !sets.always.has(item.id)
  );
  for (const item of [...auto].sort(
    (a, b) => (b.priority ?? 0) - (a.priority ?? 0)
  )) {
    if (!isPlaced(item.id, state)) placeItem(item.id, state);
  }
  // 3. Anything left, in source order.
  for (const item of items) {
    if (!isPlaced(item.id, state)) placeItem(item.id, state);
  }
  return { visibleIds: state.visibleIds, overflowIds: state.overflowIds };
}

function partitionByVisibleCount(
  items: readonly ActionBarItem[],
  maxVisible: number
): ActionBarPartition {
  if (maxVisible <= 0) return { visible: [], overflow: [...items] };
  const { visibleIds, overflowIds } = pickVisibleIds(
    items,
    maxVisible,
    itemSets(items)
  );
  return {
    visible: items.filter((item) => visibleIds.has(item.id)),
    overflow: items.filter((item) => overflowIds.has(item.id)),
  };
}

/** Prefer no More menu when overflow would hold fewer than two actions. */
function expandSingletonOverflow(
  partition: ActionBarPartition
): ActionBarPartition {
  if (partition.overflow.length !== 1) return partition;
  return {
    visible: [...partition.visible, ...partition.overflow],
    overflow: [],
  };
}

/** Before the first layout pass, budget is unknown — keep inline items visible. */
function partitionBeforeMeasure(
  items: readonly ActionBarItem[]
): ActionBarPartition {
  const { always } = itemSets(items);
  return expandSingletonOverflow({
    visible: items.filter((item) => !always.has(item.id)),
    overflow: items.filter((item) => always.has(item.id)),
  });
}

export function maxIconSlots(
  availableWidth: number,
  slotWidth: number,
  gap: number = ACTION_BAR_DEFAULT_GAP
): number {
  const slotStride = slotWidth + gap;
  if (slotStride <= 0) return 0;
  return Math.floor(availableWidth / slotStride);
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
  if (items.length === 0) return { visible: [], overflow: [] };
  if (layout.containerWidth <= 0) return partitionBeforeMeasure(items);

  const gap = layout.gap ?? ACTION_BAR_DEFAULT_GAP;
  const slotWidth = layout.slotWidth ?? layout.buttonSize;
  const budget = actionBarBudgetWidth(
    layout.containerWidth,
    layout.reservedWidth ?? 0
  );
  const slots = maxIconSlots(budget, slotWidth, gap);

  const fitted = partitionByVisibleCount(items, slots);
  if (fitted.overflow.length === 0) return fitted;

  // Reserve a More slot only when at least two actions would overflow.
  if (slots > 0) {
    const withTrigger = partitionByVisibleCount(items, slots - 1);
    if (withTrigger.overflow.length >= 2) return withTrigger;
  }
  return expandSingletonOverflow(fitted);
}

export type ScreenBaseActionLike = {
  label: JSX.Element;
  onClick: () => void;
  disabled?: boolean | undefined;
  loading?: boolean | undefined;
  icon?: IconComponent | undefined;
  endsGroup?: boolean | undefined;
  overflow?: ActionBarOverflowPolicy | undefined;
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
    onClick: action.onClick,
    disabled: action.disabled,
    loading: action.loading,
    endsGroup: action.endsGroup,
    overflow: action.overflow,
  };
}

export type TextActionPartition = {
  inline: ActionBarTextAction[];
  overflow: ActionBarTextAction[];
};

export function partitionTextActions(
  actions: readonly ActionBarTextAction[],
  overflowMode: ActionBarOverflowMode
): TextActionPartition {
  if (overflowMode === 'never') return { inline: [...actions], overflow: [] };
  const inline: ActionBarTextAction[] = [];
  const overflow: ActionBarTextAction[] = [];
  for (const action of actions) {
    if (action.overflow === 'always') overflow.push(action);
    else inline.push(action);
  }
  return { inline, overflow };
}

export type CombinedOverflow = {
  partition: ActionBarPartition;
  inlineText: ActionBarTextAction[];
  overflowText: ActionBarTextAction[];
};

/** Expand a combined one-item overflow so More never holds a single action. */
export function resolveCombinedOverflow(
  iconPartition: ActionBarPartition,
  text: TextActionPartition
): CombinedOverflow {
  const total = iconPartition.overflow.length + text.overflow.length;
  if (total !== 1) {
    return {
      partition: iconPartition,
      inlineText: [...text.inline],
      overflowText: [...text.overflow],
    };
  }
  if (iconPartition.overflow.length === 1) {
    return {
      partition: {
        visible: [...iconPartition.visible, ...iconPartition.overflow],
        overflow: [],
      },
      inlineText: [...text.inline],
      overflowText: [],
    };
  }
  return {
    partition: iconPartition,
    inlineText: [...text.inline, ...text.overflow],
    overflowText: [],
  };
}

export function actionBarHasContent(p: {
  itemCount: number;
  inlineTextCount: number;
  overflowCount: number;
  hasEndSlot: boolean;
}): boolean {
  return (
    p.itemCount > 0 ||
    p.inlineTextCount > 0 ||
    p.overflowCount > 0 ||
    p.hasEndSlot
  );
}
