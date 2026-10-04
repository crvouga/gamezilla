/**
 * `useActionBarController` -- Solid state for `ActionBar`: menu open/close,
 * container / end-slot measurement, and the derived inline vs overflow
 * partition (framework-free math in `action-bar-logic.ts`).
 */

import { type Accessor, createMemo, createSignal } from 'solid-js';
import type { AnchoredMenuController } from './use-anchored-menu';
import type { OverflowMenuAction } from './overflow-menu-button';
import { useAnchoredMenu } from './use-anchored-menu';
import { ACTION_BAR_DEFAULT_GAP, actionBarHasContent, partitionActionBarItems, partitionTextActions, resolveCombinedOverflow } from './action-bar-logic';
import type { ActionBarAlign, ActionBarItem, ActionBarOverflowMode, ActionBarPartition, ActionBarTextAction } from './action-bar-logic';
import { collectOverflowActions } from './action-bar-overflow';
import { createElementWidth } from './create-element-width';

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
  return {
    buttonSize,
    gap: input.gap ?? ACTION_BAR_DEFAULT_GAP,
    slotWidth: input.slotWidth ?? Math.max(buttonSize, MIN_SLOT_WIDTH),
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

function computeLayout(args: {
  items: readonly ActionBarItem[];
  resolved: ResolvedActionBarProps;
  containerWidth: number;
  reservedWidth: number;
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

export type ActionBarController = {
  menu: AnchoredMenuController;
  resolved: Accessor<ResolvedActionBarProps>;
  layout: Accessor<ActionBarLayout>;
  hasContent: Accessor<boolean>;
  /** True when the bar measures itself (overflow !== 'never'). */
  measures: Accessor<boolean>;
  setContainer: (el: HTMLElement) => void;
  setEndSlot: (el: HTMLElement) => void;
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
  const measures = (): boolean => resolved().overflow !== 'never';
  const reservedWidth = (): number =>
    input.hasEndSlot && endSlotWidth() > 0
      ? endSlotWidth() + resolved().gap
      : 0;
  const layout = createMemo(() =>
    computeLayout({
      items: input.items,
      resolved: resolved(),
      containerWidth: measures() ? containerWidth() : 0,
      reservedWidth: reservedWidth(),
      onClose: menu.close,
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
  };
}
