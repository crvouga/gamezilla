import { useLingui } from '@lingui/react/macro';
import type { LocalizedString } from '@pkgs/i18n';
import type { ReactNode } from 'react';

import { useTheme } from '../../theme';
import { Box } from '../box';
import { Button } from '../button';
import {
  type FloatingMenuContent,
  type FloatingMenuContentRow,
  type FloatingMenuHeaderSpec,
} from '../floating-menu';
import { IconButton } from '../icon-button';
import { EllipsisIcon, MenuIcon } from '../icons';
import type { OverflowMenuAction } from '../overflow-menu-button/overflow-menu-button';
import { ActionBarIconButton } from './action-bar-icon-button';
import { ActionBarLabeledControl } from './action-bar-labeled-control';
import type { ActionBarTextAction } from './action-bar-types';
import {
  isActionBarAvatarItem,
  type ActionBarAvatarItem,
  type ActionBarItem,
} from './partition-action-bar-items';

export function buildOverflowMenuContent(
  actions: readonly OverflowMenuAction[],
  header?: FloatingMenuHeaderSpec
): FloatingMenuContent {
  const rows: FloatingMenuContentRow[] = [];
  actions.forEach((action, idx) => {
    rows.push({
      type: 'item',
      id: action.id,
      label: action.label,
      icon: action.icon ?? EllipsisIcon,
      onPress: action.onPress,
      ...(action.subtitle !== undefined ? { subtitle: action.subtitle } : {}),
      ...(action.leading !== undefined ? { leading: action.leading } : {}),
      ...(action.trailing !== undefined ? { trailing: action.trailing } : {}),
      ...(action.disabled !== undefined ? { disabled: action.disabled } : {}),
      ...(action.accessibilityLabel !== undefined
        ? { accessibilityLabel: action.accessibilityLabel }
        : {}),
    });
    if (action.endsGroup === true && idx < actions.length - 1) {
      rows.push({ type: 'divider', id: `${action.id}-end-group` });
    }
  });
  return {
    ...(header !== undefined ? { header } : {}),
    rows,
  };
}

export type ActionBarOverflowTriggerSpec =
  | {
      variant: 'avatar';
      children: ReactNode;
      label: LocalizedString;
      testID?: string;
    }
  | undefined;

function ActionBarAvatarItemButton(p: {
  item: ActionBarAvatarItem;
  buttonSize: number;
  showInlineLabel: boolean;
  slotWidth: number;
}): ReactNode {
  const disabled = p.item.disabled === true || p.item.loading === true;
  const caption = p.item.shortLabel ?? p.item.label;

  if (p.showInlineLabel) {
    return (
      <ActionBarLabeledControl
        caption={caption}
        label={p.item.label}
        buttonSize={p.buttonSize}
        slotWidth={p.slotWidth}
        disabled={disabled}
        onPress={p.item.onPress}
      >
        {p.item.children}
      </ActionBarLabeledControl>
    );
  }

  return (
    <IconButton
      variant="avatar"
      size={p.buttonSize}
      label={p.item.label}
      onPress={p.item.onPress}
      tooltip="hover"
      disabled={disabled}
    >
      {p.item.children}
    </IconButton>
  );
}

export function ActionBarOverflowTrigger(p: {
  buttonSize: number;
  onOpen: () => void;
  triggerRef: React.RefObject<React.ElementRef<typeof Box> | null>;
  testID?: string;
  overflowTrigger?: ActionBarOverflowTriggerSpec;
  showInlineLabels?: boolean;
  slotWidth?: number;
}): ReactNode {
  const theme = useTheme();
  const { t } = useLingui();
  const moreLabel = t`More`;
  const showInlineLabels = p.showInlineLabels === true;
  const slotWidth = p.slotWidth ?? p.buttonSize;
  const iconSize = Math.round(p.buttonSize * 0.55);

  if (p.overflowTrigger?.variant === 'avatar') {
    const trigger = p.overflowTrigger;
    return (
      <Box ref={p.triggerRef} collapsable={false}>
        <IconButton
          variant="avatar"
          size={p.buttonSize}
          onPress={p.onOpen}
          label={trigger.label}
          accessibilityLabel={trigger.label}
          tooltip="hover"
          {...(trigger.testID !== undefined ? { testID: trigger.testID } : {})}
        >
          {trigger.children}
        </IconButton>
      </Box>
    );
  }

  const menuIcon = <MenuIcon size={iconSize} color={theme.colors.icon} />;

  if (showInlineLabels) {
    return (
      <Box ref={p.triggerRef} collapsable={false}>
        <ActionBarLabeledControl
          caption={moreLabel}
          label={moreLabel}
          buttonSize={p.buttonSize}
          slotWidth={slotWidth}
          onPress={p.onOpen}
          {...(p.testID !== undefined ? { testID: p.testID } : {})}
        >
          {menuIcon}
        </ActionBarLabeledControl>
      </Box>
    );
  }

  return (
    <Box ref={p.triggerRef} collapsable={false}>
      <IconButton
        size={p.buttonSize}
        onPress={p.onOpen}
        label={moreLabel}
        tooltip="hover"
        {...(p.testID !== undefined ? { testID: p.testID } : {})}
      >
        {menuIcon}
      </IconButton>
    </Box>
  );
}

export function ActionBarIconItems(p: {
  items: readonly ActionBarItem[];
  buttonSize: number;
  showInlineLabels?: boolean;
  slotWidth?: number;
}): ReactNode {
  const showInlineLabels = p.showInlineLabels === true;
  const slotWidth = p.slotWidth ?? p.buttonSize;
  return (
    <>
      {p.items.map((item) => {
        if (isActionBarAvatarItem(item)) {
          return (
            <ActionBarAvatarItemButton
              key={item.id}
              item={item}
              buttonSize={p.buttonSize}
              showInlineLabel={showInlineLabels}
              slotWidth={slotWidth}
            />
          );
        }
        return (
          <ActionBarIconButton
            key={item.id}
            item={item}
            buttonSize={p.buttonSize}
            showInlineLabel={showInlineLabels}
            slotWidth={slotWidth}
          />
        );
      })}
    </>
  );
}

export function ActionBarTextItems(p: {
  actions: readonly ActionBarTextAction[];
}): ReactNode {
  return (
    <>
      {p.actions.map((action) => (
        <Button
          key={action.id}
          title={action.label}
          onPress={action.onPress}
          intent={action.intent ?? 'neutral'}
          size="sm"
          loading={action.loading ?? false}
          disabled={action.disabled ?? false}
        />
      ))}
    </>
  );
}

export function textActionsToOverflow(
  actions: readonly ActionBarTextAction[],
  onClose: () => void
): OverflowMenuAction[] {
  return actions.map((action) => ({
    id: action.id,
    label: action.label,
    icon: EllipsisIcon,
    onPress: () => {
      onClose();
      action.onPress();
    },
    ...(action.disabled !== undefined ? { disabled: action.disabled } : {}),
  }));
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
