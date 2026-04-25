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
import { IconSymbol } from '../symbol-icon';
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
  /** Panel body: header + rows (items and dividers). */
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
        <RNPressable
          accessibilityLabel="Dismiss menu"
          onPress={onClose}
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.25)' }}
        />
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
          background: 'surface',
          borderRadius: borderRadius.lg,
          borderWidth: 1,
          borderColor: 'border',
          py: 2,
          boxShadow: '0px 8px 16px rgba(0, 0, 0, 0.12)',
          elevation: 8,
        }}
      >
        <FloatingMenuHeader
          title={content.header.title}
          {...(content.header.subtitle !== undefined
            ? { subtitle: content.header.subtitle }
            : {})}
        />
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
  return (
    <FloatingMenuItem
      label={row.label}
      leading={
        <IconSymbol name={row.icon} size={18} color={theme.colors.icon} />
      }
      trailing={row.trailing}
      onPress={row.onPress}
      disabled={row.disabled}
      accessibilityLabel={row.accessibilityLabel}
    />
  );
}
