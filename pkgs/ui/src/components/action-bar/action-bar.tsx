/**
 * `ActionBar` -- responsive row of icon actions with overflow menu.
 */

import { useLingui } from '@lingui/react/macro';
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
import {
  useActionBarLayout,
  type ActionBarTextAction,
} from './use-action-bar-layout';

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

export type ActionBarProps = {
  items: readonly ActionBarItem[];
  /** Icon-less actions that render as compact text buttons when visible inline. */
  textActions?: readonly ActionBarTextAction[];
  /** Always-visible trailing slot (e.g. account avatar menu). */
  endSlot?: ReactNode;
  buttonSize?: number;
  gap?: number;
  overflowTestID?: string;
};

function ActionBarRow(p: {
  layout: ReturnType<typeof useActionBarLayout>;
  buttonSize: number;
  gap: number;
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
        justifyContent: 'flex-end',
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

export function ActionBar({
  items,
  textActions = [],
  endSlot,
  buttonSize = DEFAULT_BUTTON_SIZE,
  gap = DEFAULT_GAP,
  overflowTestID,
}: ActionBarProps): ReactNode {
  const { t } = useLingui();
  const menu = useAnchoredMenu();
  const insets = useContext(SafeAreaInsetsContext) ?? ZERO_SAFE_AREA;
  const layout = useActionBarLayout({
    items,
    textActions,
    endSlot,
    buttonSize,
    gap,
    onMenuClose: menu.close,
  });

  const overflowActions = useMemo(() => {
    const fromText = textActionsToOverflow(
      layout.overflowTextActions,
      menu.close
    );
    return [...layout.overflowItemActions, ...fromText];
  }, [layout.overflowItemActions, layout.overflowTextActions, menu.close]);

  const menuContent = useMemo(
    (): FloatingMenuContent => buildOverflowMenuContent(overflowActions, t`More`),
    [overflowActions, t]
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
    <>
      <ActionBarRow
        layout={layout}
        buttonSize={buttonSize}
        gap={gap}
        endSlot={endSlot}
        overflowActions={overflowActions}
        onOpenMenu={menu.openMenu}
        triggerRef={menu.triggerRef}
        {...(overflowTestID !== undefined ? { overflowTestID } : {})}
      />
      <FloatingMenu
        open={menu.open}
        onClose={menu.close}
        anchor={menu.anchor}
        insets={{ top: insets.top, bottom: insets.bottom }}
        width={FLOATING_MENU_DEFAULT_WIDTH}
        content={menuContent}
      />
    </>
  );
}
