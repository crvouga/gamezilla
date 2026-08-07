import type { ReactNode } from 'react';
import { useContext, useEffect, useState } from 'react';
import { Pressable as RNPressable, StyleSheet, View } from 'react-native';
import {
  GestureDetector,
  type GestureType,
} from 'react-native-gesture-handler';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';

import { type ComponentDataSet, componentDataSet } from '../../component-id';
import { useHoverCapable, useTheme } from '../../theme';
import { Box } from '../box';
import { statusBarGrabCursor } from './status-bar-cursor';
import type { RegisteredStatusBarItem } from './types';

/** Body height of the thin strip (excluding safe-area inset). */
export const STATUS_BAR_BODY_HEIGHT = 22;

/** z-index below surfaces/banners so modals still cover the strip. */
const STATUS_BAR_Z_INDEX = 1000;

const ZERO_INSETS = { top: 0, right: 0, bottom: 0, left: 0 };

export type StatusBarStripProps = {
  items: readonly RegisteredStatusBarItem[];
  /** Pan that interactively reveals the Control Center overlay. */
  openPan: GestureType;
  /** True while the open pan is held (web `grabbing` cursor). */
  isGrabbing: boolean;
  /** Accessibility / programmatic open (no gesture). */
  onOpen: () => void;
  accessibilityLabel: string;
  dataSet?: ComponentDataSet;
};

/**
 * Thin smartphone-style strip. Extends a themed fill through the system
 * safe-area, then lays indicator icons in a {@link STATUS_BAR_BODY_HEIGHT}
 * row. Swipe down drives reveal progress (tap does not open).
 * Hover / grab use the same interactive tint as {@link Pressable}.
 */
export function StatusBarStrip({
  items,
  openPan,
  isGrabbing,
  onOpen,
  accessibilityLabel,
  dataSet,
}: StatusBarStripProps): ReactNode {
  const theme = useTheme();
  const hoverCapable = useHoverCapable();
  const [hovered, setHovered] = useState(false);
  const insets = useContext(SafeAreaInsetsContext) ?? ZERO_INSETS;
  const topInset = insets.top;
  const totalHeight = topInset + STATUS_BAR_BODY_HEIGHT;

  useEffect(() => {
    if (!hoverCapable) setHovered(false);
  }, [hoverCapable]);

  const tintColor =
    hoverCapable && hovered && !isGrabbing
      ? theme.colors.interactiveHover
      : null;

  return (
    <GestureDetector gesture={openPan}>
      <RNPressable
        {...componentDataSet('StatusBar', dataSet)}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityHint="Swipe down to open"
        accessibilityActions={[{ name: 'activate' }]}
        onAccessibilityAction={(event) => {
          if (event.nativeEvent.actionName === 'activate') {
            onOpen();
          }
        }}
        onHoverIn={() => {
          if (hoverCapable) setHovered(true);
        }}
        onHoverOut={() => setHovered(false)}
        style={[
          {
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            zIndex: STATUS_BAR_Z_INDEX,
            height: totalHeight,
            paddingTop: topInset,
            backgroundColor: theme.colors.surface,
          },
          statusBarGrabCursor(isGrabbing),
        ]}
      >
        <View
          style={{
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'flex-end',
            paddingHorizontal: 10,
            gap: 8,
          }}
        >
          {items.map((item) => (
            <Box
              key={item.id}
              sx={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              accessibilityLabel={item.accessibilityLabel}
            >
              {item.indicator}
            </Box>
          ))}
        </View>
        {tintColor ? (
          <View
            pointerEvents="none"
            style={[styles.tint, { backgroundColor: tintColor }]}
          />
        ) : null}
      </RNPressable>
    </GestureDetector>
  );
}

/**
 * Vertical space reserved for the strip body so the absolute overlay does
 * not cover TopBar. Safe-area top inset is still applied by ScreenBase /
 * TopBar; only the indicator row height is pushed here.
 */
export function useStatusBarPushHeight(): number {
  return STATUS_BAR_BODY_HEIGHT;
}

const styles = StyleSheet.create({
  tint: {
    ...StyleSheet.absoluteFillObject,
  },
});
