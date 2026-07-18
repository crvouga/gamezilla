/**
 * `FloatingMenu` -- anchored overlay panel (modal + dimmed backdrop).
 * Content is **prop-driven** via {@link FloatingMenuContent}; subcomponents are internal.
 */

import {
  Pressable as RNPressable,
  View,
  type LayoutRectangle,
} from 'react-native';

import { useTheme } from '../../theme';
import { borderRadius } from '../../theme/scale';
import { Box } from '../box';
import { ModalRoot } from '../modal/modal-root';
import type { FloatingMenuContent } from './floating-menu-content';
import { FloatingMenuDivider } from './floating-menu-divider';
import { estimateFloatingMenuHeight } from './floating-menu-estimate-height';
import { FloatingMenuHeader } from './floating-menu-header';
import { FloatingMenuItem } from './floating-menu-item';
import {
  computeFloatingMenuPosition,
  type FloatingMenuInsets,
} from './floating-menu-position';

export const FLOATING_MENU_DEFAULT_WIDTH = 260;

export type FloatingMenuProps = {
  open: boolean;
  onClose: () => void;
  anchor: LayoutRectangle | null;
  insets: FloatingMenuInsets;
  width?: number;
  /** Panel body: optional header + rows (items and dividers). */
  content: FloatingMenuContent;
};

export type {
  FloatingMenuContent,
  FloatingMenuContentRow,
  FloatingMenuDividerRow,
  FloatingMenuHeaderSpec,
  FloatingMenuItemRow,
} from './floating-menu-content';

export function FloatingMenu({
  open,
  onClose,
  anchor,
  insets,
  width = FLOATING_MENU_DEFAULT_WIDTH,
  content,
}: FloatingMenuProps) {
  const visible = open && anchor !== null;
  const estimatedHeight = estimateFloatingMenuHeight(content);
  const position =
    anchor !== null
      ? computeFloatingMenuPosition({
          anchor,
          menuHeight: estimatedHeight,
          insets,
          menuWidth: width,
        })
      : { top: 0, left: 0 };

  return (
    <ModalRoot visible={visible} onRequestClose={onClose}>
      <View style={{ flex: 1 }}>
        <FloatingMenuBackdrop onClose={onClose} />
        {anchor !== null ? (
          <FloatingMenuPanel
            top={position.top}
            left={position.left}
            width={width}
            content={content}
          />
        ) : null}
      </View>
    </ModalRoot>
  );
}

function FloatingMenuBackdrop({ onClose }: { onClose: () => void }) {
  const theme = useTheme();
  return (
    <RNPressable
      accessibilityLabel="Dismiss menu"
      onPress={onClose}
      style={{ flex: 1, backgroundColor: theme.colors.scrim }}
    />
  );
}

function FloatingMenuPanel({
  top,
  left,
  width,
  content,
}: {
  top: number;
  left: number;
  width: number;
  content: FloatingMenuContent;
}) {
  const theme = useTheme();
  const lift = theme.elevation(3);
  const bg = lift.backgroundColor ?? theme.colors.surfaceOverlay;
  return (
    <View
      style={{
        position: 'absolute',
        top,
        left,
        width,
        zIndex: 10,
        pointerEvents: 'box-none',
      }}
    >
      <Box
        sx={{
          borderRadius: borderRadius.lg,
          borderWidth: 1,
          borderColor: 'border',
          py: 2,
        }}
        style={{
          backgroundColor: bg,
          ...(lift.boxShadow ? { boxShadow: lift.boxShadow } : {}),
          ...(lift.elevation !== undefined
            ? { elevation: lift.elevation }
            : {}),
        }}
      >
        {content.header !== undefined ? (
          <FloatingMenuHeader
            title={content.header.title}
            {...(content.header.subtitle !== undefined
              ? { subtitle: content.header.subtitle }
              : {})}
            {...(content.header.avatar !== undefined
              ? { avatar: content.header.avatar }
              : {})}
          />
        ) : null}
        {content.rows.map(renderFloatingMenuRow)}
      </Box>
    </View>
  );
}

function renderFloatingMenuRow(row: FloatingMenuContent['rows'][number]) {
  if (row.type === 'divider') return <FloatingMenuDivider key={row.id} />;
  return <FloatingMenuRowItem key={row.id} row={row} />;
}

function FloatingMenuRowItem({
  row,
}: {
  row: Exclude<FloatingMenuContent['rows'][number], { type: 'divider' }>;
}) {
  const theme = useTheme();
  const RowIcon = row.icon;
  const leading =
    row.leading !== undefined ? (
      row.leading
    ) : (
      <RowIcon size={18} color={theme.colors.icon} />
    );
  return (
    <FloatingMenuItem
      label={row.label}
      leading={leading}
      trailing={row.trailing}
      onPress={row.onPress}
      disabled={row.disabled}
      {...(row.accessibilityLabel !== undefined
        ? { accessibilityLabel: row.accessibilityLabel }
        : {})}
    />
  );
}
