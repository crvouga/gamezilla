/**
 * `ActionBar` -- responsive row of icon actions with overflow menu.
 */

import { useContext, useMemo, type ReactNode } from 'react';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';

import { Box } from '../box';
import {
  FLOATING_MENU_DEFAULT_WIDTH,
  FloatingMenu,
  type FloatingMenuContent,
} from '../floating-menu';
import { useAnchoredMenu } from '../overflow-menu-button/use-anchored-menu';
import type { OverflowMenuAction } from '../overflow-menu-button/overflow-menu-button';
import {
  ActionBarIconItems,
  ActionBarOverflowTrigger,
  ActionBarTextItems,
  actionBarHasContent,
  buildOverflowMenuContent,
  textActionsToOverflow,
} from './action-bar-parts';
import type { ActionBarItem } from './partition-action-bar-items';
import type { ActionBarTextAction } from './action-bar-types';
import { useActionBarLayout } from './use-action-bar-layout';

const ZERO_SAFE_AREA = { top: 0, right: 0, bottom: 0, left: 0 };
const DEFAULT_BUTTON_SIZE = 36;
const DEFAULT_GAP = 8;

export type { ActionBarItem } from './partition-action-bar-items';
export {
  actionBarBudgetWidth,
  isActionBarAvatarItem,
  partitionActionBarItems,
  screenBaseActionToActionBarItem,
} from './partition-action-bar-items';

export type ActionBarAlign = 'start' | 'end';

export type ActionBarOverflowMode = 'auto' | 'never';

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
  buttonSize?: number;
  gap?: number;
  overflowTestID?: string;
};

function ActionBarRow(p: {
  layout: ReturnType<typeof useActionBarLayout>;
  buttonSize: number;
  gap: number;
  align: ActionBarAlign;
  endSlot: ReactNode | undefined;
  overflowActions: OverflowMenuAction[];
  onOpenMenu: () => void;
  triggerRef: React.RefObject<React.ElementRef<typeof Box> | null>;
  overflowTestID?: string;
}): ReactNode {
  return (
    <Box
      sx={{
        flex: 1,
        minWidth: 0,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: p.align === 'start' ? 'flex-start' : 'flex-end',
        gap: 2,
      }}
      style={{ gap: p.gap }}
      onLayout={p.layout.onContainerLayout}
    >
      <Box
        sx={{ flexDirection: 'row', alignItems: 'center', gap: 2, minWidth: 0 }}
        style={{ gap: p.gap }}
      >
        <ActionBarTextItems actions={p.layout.inlineTextActions} />
        <ActionBarIconItems
          items={p.layout.partition.visible}
          buttonSize={p.buttonSize}
        />
        {p.overflowActions.length > 0 ? (
          <ActionBarOverflowTrigger
            buttonSize={p.buttonSize}
            onOpen={p.onOpenMenu}
            triggerRef={p.triggerRef}
            {...(p.overflowTestID !== undefined ? { testID: p.overflowTestID } : {})}
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

function collectOverflowActions(args: {
  overflow: ActionBarOverflowMode;
  overflowItemActions: ReturnType<typeof useActionBarLayout>['overflowItemActions'];
  overflowTextActions: readonly ActionBarTextAction[];
  onClose: () => void;
}): OverflowMenuAction[] {
  if (args.overflow === 'never') return [];
  return [
    ...args.overflowItemActions,
    ...textActionsToOverflow(args.overflowTextActions, args.onClose),
  ];
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
  layout: ReturnType<typeof useActionBarLayout>;
  buttonSize: number;
  gap: number;
  align: ActionBarAlign;
  endSlot: ReactNode | undefined;
  overflow: ActionBarOverflowMode;
  overflowActions: OverflowMenuAction[];
  menu: ReturnType<typeof useAnchoredMenu>;
  menuContent: FloatingMenuContent;
  overflowTestID?: string;
}): ReactNode {
  return (
    <>
      <ActionBarRow
        layout={p.layout}
        buttonSize={p.buttonSize}
        gap={p.gap}
        align={p.align}
        endSlot={p.endSlot}
        overflowActions={p.overflowActions}
        onOpenMenu={p.menu.openMenu}
        triggerRef={p.menu.triggerRef}
        {...(p.overflowTestID !== undefined
          ? { overflowTestID: p.overflowTestID }
          : {})}
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

export function ActionBar({
  items,
  textActions = [],
  endSlot,
  align = 'end',
  overflow = 'auto',
  buttonSize = DEFAULT_BUTTON_SIZE,
  gap = DEFAULT_GAP,
  overflowTestID,
}: ActionBarProps): ReactNode {
  const menu = useAnchoredMenu();
  const layout = useActionBarLayout({
    items,
    textActions,
    endSlot,
    buttonSize,
    gap,
    overflow,
    onMenuClose: menu.close,
  });

  const overflowActions = useMemo(
    () =>
      collectOverflowActions({
        overflow,
        overflowItemActions: layout.overflowItemActions,
        overflowTextActions: layout.overflowTextActions,
        onClose: menu.close,
      }),
    [
      overflow,
      layout.overflowItemActions,
      layout.overflowTextActions,
      menu.close,
    ]
  );

  const menuContent = useMemo(
    (): FloatingMenuContent => buildOverflowMenuContent(overflowActions),
    [overflowActions]
  );

  if (
    !actionBarHasContent({
      itemCount: items.length,
      inlineTextCount: layout.inlineTextActions.length,
      overflowCount: overflowActions.length,
      hasEndSlot: endSlot !== undefined && endSlot !== null,
    })
  ) {
    return null;
  }

  return (
    <ActionBarBody
      layout={layout}
      buttonSize={buttonSize}
      gap={gap}
      align={align}
      endSlot={endSlot}
      overflow={overflow}
      overflowActions={overflowActions}
      menu={menu}
      menuContent={menuContent}
      {...(overflowTestID !== undefined ? { overflowTestID } : {})}
    />
  );
}
