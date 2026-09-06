/**
 * `FloatingMenu` -- anchored overlay panel (modal + dimmed backdrop).
 * Content is **prop-driven** via {@link FloatingMenuContent}; subcomponents are internal.
 */

import type { LayoutRectangle } from 'react-native';

import type { ComponentDataSet } from '../../component-id';
import { useTheme } from '../../theme';
import { borderRadius } from '../../theme/scale';
import { Box } from '../box';
import { ModalRoot } from '../modal/modal-root';
import { windowRectToHostLocal } from '../portal-host-frame';
import { Pressable } from '../pressable';
import { useSurfaceStackHostFrame } from '../surface-stack';
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
  /** Window-space anchor from `measureInWindow`. */
  anchor: LayoutRectangle | null;
  insets: FloatingMenuInsets;
  width?: number;
  /** Panel body: optional header + rows (items and dividers). */
  content: FloatingMenuContent;
  /** Web DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet;
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
  dataSet,
}: FloatingMenuProps) {
  const theme = useTheme();
  const host = useSurfaceStackHostFrame();
  const visible = open && anchor !== null;
  const estimatedHeight = estimateFloatingMenuHeight(content);
  const localAnchor =
    anchor !== null ? windowRectToHostLocal(anchor, host) : null;
  const viewportWidth = host.width > 0 ? host.width : theme.layout.width;
  const viewportHeight = host.height > 0 ? host.height : theme.layout.height;
  const position =
    localAnchor !== null
      ? computeFloatingMenuPosition({
          anchor: localAnchor,
          menuHeight: estimatedHeight,
          insets,
          menuWidth: width,
          viewport: { width: viewportWidth, height: viewportHeight },
        })
      : { top: 0, left: 0 };

  return (
    <ModalRoot visible={visible} onRequestClose={onClose}>
      <Box sx={{ flex: 1 }} dataSet={{ component: 'FloatingMenu', ...dataSet }}>
        <FloatingMenuBackdrop onClose={onClose} />
        {localAnchor !== null ? (
          <FloatingMenuPanel
            top={position.top}
            left={position.left}
            width={width}
            content={content}
          />
        ) : null}
      </Box>
    </ModalRoot>
  );
}

function FloatingMenuBackdrop({ onClose }: { onClose: () => void }) {
  return (
    <Pressable
      accessibilityLabel="Dismiss menu"
      onPress={onClose}
      feedback="none"
      sx={{ flex: 1, backgroundColor: 'scrim' }}
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
    <Box
      pointerEvents="box-none"
      sx={{
        position: 'absolute',
        top,
        left,
        width,
        zIndex: 10,
      }}
    >
      <Box
        sx={{
          borderRadius: borderRadius.lg,
          borderWidth: 1,
          borderColor: 'border',
          py: 2,
          backgroundColor: bg,
          elevation: 3,
          ...(lift.boxShadow ? { boxShadow: lift.boxShadow } : {}),
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
    </Box>
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
      {...(row.subtitle !== undefined ? { subtitle: row.subtitle } : {})}
      {...(row.accessibilityLabel !== undefined
        ? { accessibilityLabel: row.accessibilityLabel }
        : {})}
      {...(row.testID !== undefined ? { testID: row.testID } : {})}
    />
  );
}
