/**
 * `OverflowMenuButton` -- icon (or custom) trigger + anchored {@link FloatingMenu}.
 *
 * Encapsulates the standard "more actions" dropdown used throughout chrome.
 * Each entry in `actions` becomes a `FloatingMenuItemRow`; `endsGroup`
 * inserts a divider after the row. The trigger renders nothing when
 * `actions` is empty so consumers can keep the component mounted
 * conditionally without juggling visibility props.
 *
 * Pass {@link OverflowMenuButtonProps.trigger} to replace the default
 * {@link IconButton} (e.g. an avatar for the app global menu).
 *
 * @example
 * ```tsx
 * <OverflowMenuButton
 *   actions={[
 *     { id: 'devtools', label: 'Developer tools', icon: CodeIcon, onPress: openDebug, endsGroup: true },
 *     { id: 'leave', label: 'Leave space', icon: LogOutIcon, onPress: leave },
 *   ]}
 *   header={{ title: 'More' }}
 * />
 * ```
 */

import type { LocalizedString } from '@pkgs/i18n';
import { type ReactNode, useContext, useMemo } from 'react';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { type ComponentDataSet, componentDataSet } from '../../component-id';
import { useTheme } from '../../theme';
import { releaseWebFocus } from '../../web/release-web-focus';
import { Box } from '../box';
import {
  FLOATING_MENU_DEFAULT_WIDTH,
  FloatingMenu,
  type FloatingMenuContent,
  type FloatingMenuContentRow,
} from '../floating-menu';
import { IconButton } from '../icon-button';
import type { IconComponent } from '../icons';
import { EllipsisIcon, MenuIcon } from '../icons';
import { Pressable } from '../pressable';
import { useAnchoredMenu } from './use-anchored-menu';

const ZERO_SAFE_AREA = { top: 0, right: 0, bottom: 0, left: 0 };

export type OverflowMenuAction = {
  /** Stable id used for the row key + a11y. */
  id: string;
  label: ReactNode;
  /** Secondary line under the label (e.g. email). */
  subtitle?: ReactNode;
  /** Defaults to {@link DEFAULT_ACTION_ICON} when omitted. */
  icon?: IconComponent;
  /** When set, replaces the icon glyph in the menu row (e.g. avatar). */
  leading?: ReactNode;
  onPress: () => void;
  trailing?: ReactNode;
  disabled?: boolean;
  /** When true, inserts a divider row after this action. */
  endsGroup?: boolean;
  accessibilityLabel?: LocalizedString;
  testID?: string;
};

export type OverflowMenuHeader = {
  title: ReactNode;
  subtitle?: ReactNode;
  avatar?: ReactNode;
};

export type OverflowMenuButtonProps = {
  /** Actions rendered inside the dropdown. */
  actions: readonly OverflowMenuAction[];
  /** Panel header (title + optional subtitle). */
  header: OverflowMenuHeader;
  /** Trigger diameter in px. Defaults to 40. Ignored when `trigger` is set. */
  size?: number;
  /** Trigger background token. Defaults to `'surface'`. Ignored when `trigger`. */
  background?: string;
  /** Trigger icon. Defaults to {@link MenuIcon}. Ignored when `trigger`. */
  icon?: IconComponent;
  /**
   * Custom trigger face. When set, wraps the node in a pressable that opens
   * the menu (default IconButton is skipped).
   */
  trigger?: ReactNode;
  /** Trigger accessibility label. */
  accessibilityLabel: LocalizedString;
  /** Width of the dropdown panel in px. */
  width?: number;
  testID?: string;
  /** Web DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet;
};

const DEFAULT_ACTION_ICON = EllipsisIcon;

function buildContent(
  actions: readonly OverflowMenuAction[],
  onClose: () => void,
  header: OverflowMenuHeader
): FloatingMenuContent {
  const rows: FloatingMenuContentRow[] = [];
  actions.forEach((a, idx) => {
    rows.push({
      type: 'item',
      id: a.id,
      label: a.label,
      icon: a.icon ?? DEFAULT_ACTION_ICON,
      onPress: () => {
        releaseWebFocus();
        onClose();
        a.onPress();
      },
      ...(a.subtitle !== undefined ? { subtitle: a.subtitle } : {}),
      ...(a.leading !== undefined ? { leading: a.leading } : {}),
      ...(a.trailing !== undefined ? { trailing: a.trailing } : {}),
      ...(a.disabled !== undefined ? { disabled: a.disabled } : {}),
      ...(a.accessibilityLabel !== undefined
        ? { accessibilityLabel: a.accessibilityLabel }
        : {}),
      ...(a.testID !== undefined ? { testID: a.testID } : {}),
    });
    if (a.endsGroup === true && idx < actions.length - 1) {
      rows.push({ type: 'divider', id: `${a.id}-end-group` });
    }
  });
  return {
    header: {
      title: header.title,
      ...(header.subtitle !== undefined ? { subtitle: header.subtitle } : {}),
      ...(header.avatar !== undefined ? { avatar: header.avatar } : {}),
    },
    rows,
  };
}

export function OverflowMenuButton({
  actions,
  header,
  size = 40,
  background = 'surface',
  icon = MenuIcon,
  trigger,
  accessibilityLabel,
  width = FLOATING_MENU_DEFAULT_WIDTH,
  testID,
  dataSet,
}: OverflowMenuButtonProps): ReactNode {
  const theme = useTheme();
  const menu = useAnchoredMenu();
  const insets = useContext(SafeAreaInsetsContext) ?? ZERO_SAFE_AREA;
  const iconSize = Math.round(size * 0.5);
  const TriggerIcon = icon;

  const content = useMemo(
    () => buildContent(actions, menu.close, header),
    [actions, menu.close, header]
  );

  if (actions.length === 0) return null;

  const triggerFace =
    trigger !== undefined ? (
      <Pressable
        onPress={menu.openMenu}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        {...(testID !== undefined ? { testID } : {})}
        sx={{ borderRadius: 'full', overflow: 'hidden' }}
      >
        {trigger}
      </Pressable>
    ) : (
      <IconButton
        size={size}
        background={background}
        onPress={menu.openMenu}
        label={accessibilityLabel}
        accessibilityLabel={accessibilityLabel}
        {...(testID !== undefined ? { testID } : {})}
      >
        <TriggerIcon size={iconSize} color={theme.colors.icon} />
      </IconButton>
    );

  return (
    <>
      <Box
        ref={menu.triggerRef}
        collapsable={false}
        {...componentDataSet('OverflowMenuButton', dataSet)}
      >
        {triggerFace}
      </Box>
      <FloatingMenu
        open={menu.open}
        onClose={menu.close}
        anchor={menu.anchor}
        insets={{ top: insets.top, bottom: insets.bottom }}
        width={width}
        content={content}
      />
    </>
  );
}
