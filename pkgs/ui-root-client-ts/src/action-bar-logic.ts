/**
 * Framework-free layout logic for `ActionBar`: which items fit inline, which
 * collapse into the More menu, and the adapter from `ScreenBase`-style
 * actions. No Solid imports at runtime (types only) so it unit-tests bare.
 */

import type { JSX } from 'solid-js';
import type { IconComponent } from './create-icon/index';

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
  dataSet?: Record<string, string> | undefined;
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
  /** Width of an item that has not been measured yet; defaults to `buttonSize`. */
  slotWidth?: number | undefined;
  gap?: number | undefined;
  reservedWidth?: number | undefined;
  /** Rendered width of an item, when it has been measured. */
  itemWidth?: ((item: ActionBarItem) => number | undefined) | undefined;
  /** Width of the More trigger; defaults to `slotWidth`. */
  moreWidth?: number | undefined;
};

export const ACTION_BAR_DEFAULT_GAP = 8;

/** Glyph size for a control `buttonSize` across: 24px in the 40px disc. */
export function actionBarGlyphSize(buttonSize: number): number {
  return Math.round(buttonSize * 0.6);
}

export function isActionBarAvatarItem(
  item: ActionBarItem
): item is ActionBarAvatarItem {
  return item.variant === 'avatar';
}

function alwaysIds(items: readonly ActionBarItem[]): Set<string> {
  return new Set(
    items.filter((item) => item.overflow === 'always').map((item) => item.id)
  );
}

/**
 * The order items claim room in: `never` items first (source order), then
 * `auto` items by descending priority. `always` items never claim room.
 */
function placementOrder(items: readonly ActionBarItem[]): ActionBarItem[] {
  const pinned = items.filter((item) => item.overflow === 'never');
  const auto = items
    .filter((item) => item.overflow !== 'never' && item.overflow !== 'always')
    .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
  return [...pinned, ...auto];
}

/** Before the first layout pass, budget is unknown — keep inline items visible. */
function partitionBeforeMeasure(
  items: readonly ActionBarItem[]
): ActionBarPartition {
  const always = alwaysIds(items);
  const visible = items.filter((item) => !always.has(item.id));
  const overflow = items.filter((item) => always.has(item.id));
  // Prefer no More menu when it would hold a single action.
  if (overflow.length === 1) return { visible: [...items], overflow: [] };
  return { visible, overflow };
}

/** Width left for icon slots after reserving fixed trailing chrome. */
export function actionBarBudgetWidth(
  containerWidth: number,
  reservedWidth: number
): number {
  return Math.max(0, containerWidth - reservedWidth);
}

/** Total width of `widths` laid out in a row `gap` apart. */
export function actionBarRowWidth(
  widths: readonly number[],
  gap: number
): number {
  if (widths.length === 0) return 0;
  return widths.reduce((sum, w) => sum + w, 0) + gap * (widths.length - 1);
}

/** The longest prefix of `order` whose row fits in `budget`. */
function fittingPrefix(
  order: readonly ActionBarItem[],
  widthOf: (item: ActionBarItem) => number,
  budget: number,
  gap: number
): Set<string> {
  const fitted = new Set<string>();
  let used = 0;
  for (const item of order) {
    const next = used + (fitted.size > 0 ? gap : 0) + widthOf(item);
    if (next > budget) break;
    fitted.add(item.id);
    used = next;
  }
  return fitted;
}

function splitByIds(
  items: readonly ActionBarItem[],
  visibleIds: Set<string>
): ActionBarPartition {
  return {
    visible: items.filter((item) => visibleIds.has(item.id)),
    overflow: items.filter((item) => !visibleIds.has(item.id)),
  };
}

/**
 * Which items render inline and which collapse into the More menu. The inline
 * row, More trigger included, always fits `containerWidth - reservedWidth`:
 * an item that does not fit collapses, whatever its policy or priority, so
 * the bar never paints outside its box. A budget too small for any item
 * yields the More trigger alone. `containerWidth <= 0` means "not measured
 * yet" and keeps every non-`always` item inline.
 */
export function partitionActionBarItems(
  items: readonly ActionBarItem[],
  layout: PartitionActionBarLayout
): ActionBarPartition {
  if (items.length === 0) return { visible: [], overflow: [] };
  if (layout.containerWidth <= 0) return partitionBeforeMeasure(items);

  const gap = layout.gap ?? ACTION_BAR_DEFAULT_GAP;
  const slotWidth = layout.slotWidth ?? layout.buttonSize;
  const moreWidth = layout.moreWidth ?? slotWidth;
  const widthOf = (item: ActionBarItem): number =>
    layout.itemWidth?.(item) ?? slotWidth;
  const budget = actionBarBudgetWidth(
    layout.containerWidth,
    layout.reservedWidth ?? 0
  );
  const order = placementOrder(items);

  const withoutMore = fittingPrefix(order, widthOf, budget, gap);
  if (withoutMore.size === items.length) return splitByIds(items, withoutMore);

  const withMore = fittingPrefix(order, widthOf, budget - moreWidth - gap, gap);
  const partition = splitByIds(items, withMore);
  // A lone overflow item takes the More trigger's place when it fits there.
  const everything = items.map(widthOf);
  if (
    partition.overflow.length === 1 &&
    actionBarRowWidth(everything, gap) <= budget
  ) {
    return { visible: [...items], overflow: [] };
  }
  return partition;
}

export type ScreenBaseActionLike = {
  label: JSX.Element;
  onClick: () => void;
  disabled?: boolean | undefined;
  loading?: boolean | undefined;
  icon?: IconComponent | undefined;
  endsGroup?: boolean | undefined;
  overflow?: ActionBarOverflowPolicy | undefined;
  dataSet?: Record<string, string> | undefined;
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
    dataSet: action.dataSet,
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

/**
 * Pull a lone overflow text action back inline so More never holds a single
 * text action. Icon overflow is already width-resolved by
 * {@link partitionActionBarItems} and is kept as is: pulling an icon back
 * inline could push the row outside its box.
 */
export function resolveCombinedOverflow(
  iconPartition: ActionBarPartition,
  text: TextActionPartition
): CombinedOverflow {
  const lonelyText =
    iconPartition.overflow.length === 0 && text.overflow.length === 1;
  return {
    partition: iconPartition,
    inlineText: lonelyText
      ? [...text.inline, ...text.overflow]
      : [...text.inline],
    overflowText: lonelyText ? [] : [...text.overflow],
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
