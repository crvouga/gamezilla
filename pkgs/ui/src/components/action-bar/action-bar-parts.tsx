import { useLingui } from '@lingui/react/macro';
import type { ReactNode } from 'react';

import { useTheme } from '../../theme';
import { Box } from '../box';
import { Button } from '../button';
import {
  type FloatingMenuContent,
  type FloatingMenuContentRow,
} from '../floating-menu';
import { IconButton } from '../icon-button';
import { EllipsisIcon, MenuIcon } from '../icons';
import type { OverflowMenuAction } from '../overflow-menu-button/overflow-menu-button';
import type { ActionBarTextAction } from './action-bar-types';
import { isActionBarAvatarItem, type ActionBarItem } from './partition-action-bar-items';

export function buildOverflowMenuContent(
  actions: readonly OverflowMenuAction[],
  title: ReactNode
): FloatingMenuContent {
  const rows: FloatingMenuContentRow[] = [];
  actions.forEach((action, idx) => {
    rows.push({
      type: 'item',
      id: action.id,
      label: action.label,
      icon: action.icon ?? EllipsisIcon,
      onPress: action.onPress,
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
  return { header: { title }, rows };
}

export function ActionBarOverflowTrigger(p: {
  buttonSize: number;
  onOpen: () => void;
  triggerRef: React.RefObject<React.ElementRef<typeof Box> | null>;
  testID?: string;
}): ReactNode {
  const theme = useTheme();
  const { t } = useLingui();
  return (
    <Box ref={p.triggerRef} collapsable={false}>
      <IconButton
        size={p.buttonSize}
        onPress={p.onOpen}
        label={t`More`}
        {...(p.testID !== undefined ? { testID: p.testID } : {})}
      >
        <MenuIcon size={Math.round(p.buttonSize * 0.55)} color={theme.colors.icon} />
      </IconButton>
    </Box>
  );
}

export function ActionBarIconItems(p: {
  items: readonly ActionBarItem[];
  buttonSize: number;
}): ReactNode {
  const theme = useTheme();
  return (
    <>
      {p.items.map((item) => {
        if (isActionBarAvatarItem(item)) {
          return (
            <IconButton
              key={item.id}
              variant="avatar"
              size={p.buttonSize}
              label={item.label}
              onPress={item.onPress}
              disabled={item.disabled === true || item.loading === true}
            >
              {item.children}
            </IconButton>
          );
        }
        const Icon = item.icon;
        return (
          <IconButton
            key={item.id}
            size={p.buttonSize}
            label={item.label}
            onPress={item.onPress}
            disabled={item.disabled === true || item.loading === true}
          >
            <Icon size={Math.round(p.buttonSize * 0.55)} color={theme.colors.icon} />
          </IconButton>
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
