/**
 * `ActionBar` -- responsive row of icon actions with overflow menu.
 */

import { useContext, type ReactNode } from 'react';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';

import { componentDataSet, type ComponentDataSet } from '../../component-id';
import { Box } from '../box';
import {
  FLOATING_MENU_DEFAULT_WIDTH,
  FloatingMenu,
  type FloatingMenuContent,
  type FloatingMenuHeaderSpec,
} from '../floating-menu';
import type { useAnchoredMenu } from '../overflow-menu-button/use-anchored-menu';
import type { OverflowMenuAction } from '../overflow-menu-button/overflow-menu-button';
import {
  ActionBarIconItems,
  ActionBarOverflowTrigger,
  type ActionBarOverflowTriggerSpec,
  ActionBarTextItems,
  actionBarHasContent,
} from './action-bar-parts';
import type { ActionBarItem } from './partition-action-bar-items';
import type {
  ActionBarAlign,
  ActionBarOverflowMode,
  ActionBarTextAction,
} from './action-bar-types';
import { useActionBarController } from './use-action-bar-controller';
import type { ActionBarLayoutState } from './use-action-bar-layout';
import { resolveActionBarProps } from './resolve-action-bar-props';

const ZERO_SAFE_AREA = { top: 0, right: 0, bottom: 0, left: 0 };

export type { ActionBarItem } from './partition-action-bar-items';
export {
  actionBarBudgetWidth,
  isActionBarAvatarItem,
  partitionActionBarItems,
  screenBaseActionToActionBarItem,
} from './partition-action-bar-items';
export type { ActionBarAlign, ActionBarOverflowMode } from './action-bar-types';

export type ActionBarProps = {
  items: readonly ActionBarItem[];
  /** Icon-less actions that render as compact text buttons when visible inline. */
  textActions?: readonly ActionBarTextAction[];
  /** Always-visible trailing slot (e.g. account avatar menu). */
  endSlot?: ReactNode;
  /** Main-axis packing. Defaults to `'end'` (trailing chrome). */
  align?: ActionBarAlign;
  /**
   * Overflow behavior. `'auto'` (default) collapses into a menu when space is
   * tight. `'never'` always renders every item as an inline icon button.
   */
  overflow?: ActionBarOverflowMode;
  /** Custom overflow trigger (e.g. avatar). Defaults to menu icon. */
  overflowTrigger?: ActionBarOverflowTriggerSpec;
  /** Optional header for the overflow dropdown panel. */
  overflowMenuHeader?: FloatingMenuHeaderSpec;
  buttonSize?: number;
  gap?: number;
  /** Horizontal budget per inline slot; defaults to `buttonSize`. */
  slotWidth?: number;
  /** When true, shows a caption under each inline action (icons, avatars, More). */
  showInlineLabels?: boolean;
  overflowTestID?: string;
  /** Web DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet;
};

function ActionBarRow(p: {
  layout: ActionBarLayoutState;
  buttonSize: number;
  gap: number;
  slotWidth: number;
  showInlineLabels: boolean;
  align: ActionBarAlign;
  endSlot: ReactNode | undefined;
  overflowActions: OverflowMenuAction[];
  onOpenMenu: () => void;
  triggerRef: React.RefObject<React.ElementRef<typeof Box> | null>;
  overflowTestID?: string;
  overflowTrigger?: ActionBarOverflowTriggerSpec;
  measuresWidth: boolean;
  dataSet?: ComponentDataSet;
}): ReactNode {
  return (
    <Box
      {...componentDataSet('ActionBar', p.dataSet)}
      collapsable={false}
      sx={{
        ...(p.measuresWidth
          ? { flex: 1, minWidth: 0, alignSelf: 'stretch' as const }
          : {}),
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: p.align === 'start' ? 'flex-start' : 'flex-end',
        gap: 2,
      }}
      style={{
        gap: p.gap,
        ...(p.measuresWidth ? { width: '100%' } : {}),
      }}
      onLayout={p.measuresWidth ? p.layout.onContainerLayout : undefined}
    >
      <Box
        sx={{ flexDirection: 'row', alignItems: 'center', gap: 2, minWidth: 0 }}
        style={{ gap: p.gap }}
      >
        <ActionBarTextItems actions={p.layout.inlineTextActions} />
        <ActionBarIconItems
          items={p.layout.partition.visible}
          buttonSize={p.buttonSize}
          showInlineLabels={p.showInlineLabels}
          slotWidth={p.slotWidth}
        />
        {p.overflowActions.length > 0 ? (
          <ActionBarOverflowTrigger
            buttonSize={p.buttonSize}
            onOpen={p.onOpenMenu}
            triggerRef={p.triggerRef}
            overflowTrigger={p.overflowTrigger}
            showInlineLabels={p.showInlineLabels}
            slotWidth={p.slotWidth}
            {...(p.overflowTestID !== undefined
              ? { testID: p.overflowTestID }
              : {})}
          />
        ) : null}
      </Box>
      {p.endSlot !== undefined && p.endSlot !== null ? (
        <Box collapsable={false} onLayout={p.layout.onEndSlotLayout}>
          {p.endSlot}
        </Box>
      ) : null}
    </Box>
  );
}

function ActionBarOverflowMenu(p: {
  open: boolean;
  onClose: () => void;
  anchor: ReturnType<typeof useAnchoredMenu>['anchor'];
  content: FloatingMenuContent;
}): ReactNode {
  const insets = useContext(SafeAreaInsetsContext) ?? ZERO_SAFE_AREA;
  return (
    <FloatingMenu
      open={p.open}
      onClose={p.onClose}
      anchor={p.anchor}
      insets={{ top: insets.top, bottom: insets.bottom }}
      width={FLOATING_MENU_DEFAULT_WIDTH}
      content={p.content}
    />
  );
}

function ActionBarBody(p: {
  layout: ActionBarLayoutState;
  buttonSize: number;
  gap: number;
  slotWidth: number;
  showInlineLabels: boolean;
  align: ActionBarAlign;
  endSlot: ReactNode | undefined;
  overflow: ActionBarOverflowMode;
  overflowActions: OverflowMenuAction[];
  overflowTrigger?: ActionBarOverflowTriggerSpec;
  menu: ReturnType<typeof useAnchoredMenu>;
  menuContent: FloatingMenuContent;
  overflowTestID?: string;
  dataSet?: ComponentDataSet;
}): ReactNode {
  const measuresWidth = p.overflow !== 'never';
  return (
    <>
      <ActionBarRow
        layout={p.layout}
        buttonSize={p.buttonSize}
        gap={p.gap}
        slotWidth={p.slotWidth}
        showInlineLabels={p.showInlineLabels}
        align={p.align}
        endSlot={p.endSlot}
        overflowActions={p.overflowActions}
        onOpenMenu={p.menu.openMenu}
        triggerRef={p.menu.triggerRef}
        overflowTrigger={p.overflowTrigger}
        measuresWidth={measuresWidth}
        {...(p.overflowTestID !== undefined
          ? { overflowTestID: p.overflowTestID }
          : {})}
        {...(p.dataSet !== undefined ? { dataSet: p.dataSet } : {})}
      />
      {p.overflow === 'never' ? null : (
        <ActionBarOverflowMenu
          open={p.menu.open}
          onClose={p.menu.close}
          anchor={p.menu.anchor}
          content={p.menuContent}
        />
      )}
    </>
  );
}

export function ActionBar(props: ActionBarProps): ReactNode {
  const resolved = resolveActionBarProps(props);
  const { menu, layout, overflowActions, menuContent } = useActionBarController(
    {
      items: resolved.items,
      textActions: resolved.textActions,
      endSlot: resolved.endSlot,
      buttonSize: resolved.buttonSize,
      slotWidth: resolved.slotWidth,
      gap: resolved.gap,
      overflow: resolved.overflow,
      ...(resolved.overflowMenuHeader !== undefined
        ? { overflowMenuHeader: resolved.overflowMenuHeader }
        : {}),
    }
  );

  if (
    !actionBarHasContent({
      itemCount: resolved.items.length,
      inlineTextCount: layout.inlineTextActions.length,
      overflowCount: overflowActions.length,
      hasEndSlot: resolved.endSlot !== undefined && resolved.endSlot !== null,
    })
  ) {
    return null;
  }

  return (
    <ActionBarBody
      layout={layout}
      buttonSize={resolved.buttonSize}
      gap={resolved.gap}
      slotWidth={resolved.slotWidth}
      showInlineLabels={resolved.showInlineLabels}
      align={resolved.align}
      endSlot={resolved.endSlot as ReactNode | undefined}
      overflow={resolved.overflow}
      overflowActions={overflowActions}
      overflowTrigger={resolved.overflowTrigger}
      menu={menu}
      menuContent={menuContent}
      {...(props.dataSet !== undefined ? { dataSet: props.dataSet } : {})}
      {...(resolved.overflowTestID !== undefined
        ? { overflowTestID: resolved.overflowTestID }
        : {})}
    />
  );
}
