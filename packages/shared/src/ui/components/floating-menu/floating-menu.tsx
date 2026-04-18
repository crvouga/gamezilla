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
  const theme = useTheme();
  const visible = open && anchor !== null;
  const estimatedHeight = estimateFloatingMenuHeight(content);
  const position =
    anchor !== null
      ? computeFloatingMenuPosition(anchor, estimatedHeight, insets, width)
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
          <View
            style={{
              position: 'absolute',
              top: position.top,
              left: position.left,
              width,
              zIndex: 10,
              pointerEvents: 'box-none',
            }}
          >
            <Box
              sx={{
                background: 'surface',
                borderRadius: 12,
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
              {content.rows.map((row) =>
                row.type === 'divider' ? (
                  <FloatingMenuDivider key={row.id} />
                ) : (
                  <FloatingMenuItem
                    key={row.id}
                    label={row.label}
                    leading={
                      row.icon !== undefined ? (
                        <IconSymbol
                          name={row.icon}
                          size={18}
                          color={theme.colors.icon}
                        />
                      ) : undefined
                    }
                    onPress={row.onPress}
                    disabled={row.disabled}
                    accessibilityLabel={row.accessibilityLabel}
                  />
                )
              )}
            </Box>
          </View>
        ) : null}
      </View>
    </ModalRoot>
  );
}
