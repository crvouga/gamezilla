/**
 * `useActionBarController` -- Solid state for `ActionBar`: menu open/close,
 * container / end-slot measurement, and the derived inline vs overflow
 * partition (framework-free math in `action-bar-logic.ts`).
 */

import { type Accessor, createMemo, createSignal } from 'solid-js';
import type {
  ActionBarAlign,
  ActionBarItem,
  ActionBarOverflowMode,
  ActionBarPartition,
  ActionBarTextAction,
} from './action-bar-logic';
import {
  ACTION_BAR_DEFAULT_GAP,
  actionBarHasContent,
  actionBarRowWidth,
  partitionActionBarItems,
  partitionTextActions,
  resolveCombinedOverflow,
} from './action-bar-logic';
import { collectOverflowActions } from './action-bar-overflow';
import { createElementWidth } from './create-element-width';
import { createKeyedWidths, type KeyedWidths } from './create-keyed-widths';
import type { OverflowMenuAction } from './overflow-menu-button/index';
import type { AnchoredMenuController } from './use-anchored-menu';
import { useAnchoredMenu } from './use-anchored-menu';

const DEFAULT_BUTTON_SIZE = 36;

/** Inline slots are never narrower than the 44px hit target. */
const MIN_SLOT_WIDTH = 44;

export type ActionBarControllerInput = {
  items: readonly ActionBarItem[];
  textActions?: readonly ActionBarTextAction[] | undefined;
  hasEndSlot: boolean;
  align?: ActionBarAlign | undefined;
  overflow?: ActionBarOverflowMode | undefined;
  buttonSize?: number | undefined;
  gap?: number | undefined;
  slotWidth?: number | undefined;
  showInlineLabels?: boolean | undefined;
};

export type ResolvedActionBarProps = {
  buttonSize: number;
  gap: number;
  slotWidth: number;
  overflow: ActionBarOverflowMode;
  align: ActionBarAlign;
  textActions: readonly ActionBarTextAction[];
};

export function resolveActionBarProps(
  input: ActionBarControllerInput
): ResolvedActionBarProps {
  const buttonSize = input.buttonSize ?? DEFAULT_BUTTON_SIZE;
  // An icon-only control is its hit target wide; a labeled one is `slotWidth`.
  const labeled =
    input.showInlineLabels === true ? (input.slotWidth ?? buttonSize) : 0;
  return {
    buttonSize,
    gap: input.gap ?? ACTION_BAR_DEFAULT_GAP,
    slotWidth: Math.max(buttonSize, labeled, MIN_SLOT_WIDTH),
    overflow: input.overflow ?? 'auto',
    align: input.align ?? 'end',
    textActions: input.textActions ?? [],
  };
}

export type ActionBarLayout = {
  partition: ActionBarPartition;
  inlineText: ActionBarTextAction[];
  overflowActions: OverflowMenuAction[];
};

/** Key for the More trigger in the measured widths. */
export const ACTION_BAR_MORE_KEY = 'more';

function computeLayout(args: {
  items: readonly ActionBarItem[];
  resolved: ResolvedActionBarProps;
  containerWidth: number;
  reservedWidth: number;
  widths: KeyedWidths;
  onClose: () => void;
}): ActionBarLayout {
  const { resolved } = args;
  const text = partitionTextActions(resolved.textActions, resolved.overflow);
  const icons: ActionBarPartition =
    resolved.overflow === 'never'
      ? { visible: [...args.items], overflow: [] }
      : partitionActionBarItems(args.items, {
          containerWidth: args.containerWidth,
          buttonSize: resolved.buttonSize,
          slotWidth: resolved.slotWidth,
          gap: resolved.gap,
          reservedWidth: args.reservedWidth,
          itemWidth: (item) => args.widths.width(itemKey(item.id)),
          moreWidth: moreWidth(args.widths, resolved),
        });
  const combined = resolveCombinedOverflow(icons, text);
  return {
    partition: combined.partition,
    inlineText: combined.inlineText,
    overflowActions: collectOverflowActions({
      overflow: resolved.overflow,
      overflowItems: combined.partition.overflow,
      overflowTextActions: combined.overflowText,
      onClose: args.onClose,
    }),
  };
}

/** Key for an icon item in the measured widths. */
export function itemKey(id: string): string {
  return `item:${id}`;
}

/** Key for a text action in the measured widths. */
export function textKey(id: string): string {
  return `text:${id}`;
}

function moreWidth(
  widths: KeyedWidths,
  resolved: ResolvedActionBarProps
): number {
  return widths.width(ACTION_BAR_MORE_KEY) ?? resolved.slotWidth;
}

/** Inline text actions, with the gap that separates them from the icons. */
function textRowWidth(
  widths: KeyedWidths,
  inlineText: readonly ActionBarTextAction[],
  gap: number
): number {
  const known = inlineText.map((a) => widths.width(textKey(a.id)) ?? 0);
  const row = actionBarRowWidth(known, gap);
  return row > 0 ? row + gap : 0;
}

/**
 * Width of the bar with every action inline (the More trigger only for
 * `always` items): the room it asks for before anything collapses.
 */
function naturalWidth(args: {
  items: readonly ActionBarItem[];
  resolved: ResolvedActionBarProps;
  widths: KeyedWidths;
  reservedWidth: number;
}): number {
  const { resolved, widths } = args;
  const inline = args.items.filter((item) => item.overflow !== 'always');
  const icons = inline.map(
    (item) => widths.width(itemKey(item.id)) ?? resolved.slotWidth
  );
  if (inline.length < args.items.length) {
    icons.push(moreWidth(widths, resolved));
  }
  return actionBarRowWidth(icons, resolved.gap) + args.reservedWidth;
}

export type ActionBarController = {
  menu: AnchoredMenuController;
  resolved: Accessor<ResolvedActionBarProps>;
  layout: Accessor<ActionBarLayout>;
  hasContent: Accessor<boolean>;
  /** True when the bar measures itself (overflow !== 'never'). */
  measures: Accessor<boolean>;
  setContainer: (el: HTMLElement) => void;
  setEndSlot: (el: HTMLElement) => void;
  /** Measured widths of inline items, text actions and the More trigger. */
  widths: KeyedWidths;
  /** Room the bar asks for with every action inline. */
  naturalWidth: Accessor<number>;
  /** Room the bar never gives up: the More trigger. */
  minWidth: Accessor<number>;
};

export function useActionBarController(
  input: ActionBarControllerInput
): ActionBarController {
  const menu = useAnchoredMenu();
  const resolved = createMemo(() => resolveActionBarProps(input));
  const [container, setContainer] = createSignal<HTMLElement | null>(null);
  const [endSlotEl, setEndSlot] = createSignal<HTMLElement | null>(null);
  const containerWidth = createElementWidth(container);
  const endSlotWidth = createElementWidth(endSlotEl);
  const widths = createKeyedWidths();
  const measures = (): boolean => resolved().overflow !== 'never';
  const endReserve = (): number =>
    input.hasEndSlot && endSlotWidth() > 0
      ? endSlotWidth() + resolved().gap
      : 0;
  const textReserve = (): number =>
    textRowWidth(
      widths,
      partitionTextActions(resolved().textActions, resolved().overflow).inline,
      resolved().gap
    );
  const reservedWidth = (): number => endReserve() + textReserve();
  const layout = createMemo(() =>
    computeLayout({
      items: input.items,
      resolved: resolved(),
      containerWidth: measures() ? containerWidth() : 0,
      reservedWidth: reservedWidth(),
      widths,
      onClose: menu.close,
    })
  );
  const natural = createMemo(() =>
    naturalWidth({
      items: input.items,
      resolved: resolved(),
      widths,
      reservedWidth: reservedWidth(),
    })
  );
  const hasContent = (): boolean =>
    actionBarHasContent({
      itemCount: input.items.length,
      inlineTextCount: layout().inlineText.length,
      overflowCount: layout().overflowActions.length,
      hasEndSlot: input.hasEndSlot,
    });
  return {
    menu,
    resolved,
    layout,
    hasContent,
    measures,
    setContainer: (el) => setContainer(el),
    setEndSlot: (el) => setEndSlot(el),
    widths,
    naturalWidth: natural,
    minWidth: () => moreWidth(widths, resolved()),
  };
}
