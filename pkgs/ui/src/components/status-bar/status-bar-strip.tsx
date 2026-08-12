import type { ReactNode } from 'react';
import { useContext, useEffect, useState } from 'react';
import {
  GestureDetector,
  type GestureType,
} from 'react-native-gesture-handler';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';

import type { ComponentDataSet } from '../../component-id';
import { useHoverCapable, useTheme } from '../../theme';
import { Box } from '../box';
import { Pressable } from '../pressable';
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

function StatusBarOpenTarget({
  accessibilityLabel,
  hoverCapable,
  onOpen,
  setHovered,
}: {
  accessibilityLabel: string;
  hoverCapable: boolean;
  onOpen: () => void;
  setHovered: (hovered: boolean) => void;
}): ReactNode {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint="Swipe down to open"
      accessibilityActions={[{ name: 'activate' }]}
      onAccessibilityAction={(event) => {
        if (event.nativeEvent.actionName === 'activate') {
          onOpen();
        }
      }}
      onPress={onOpen}
      onHoverIn={() => {
        if (hoverCapable) setHovered(true);
      }}
      onHoverOut={() => setHovered(false)}
      feedback="none"
      sx={{ absoluteFill: true }}
    />
  );
}

function StatusBarIndicatorItem({
  item,
}: {
  item: RegisteredStatusBarItem;
}): ReactNode {
  const indicator = (
    <Box
      sx={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {item.indicator}
    </Box>
  );
  if (item.onPress === undefined) {
    return (
      <Box
        pointerEvents="none"
        accessibilityLabel={item.accessibilityLabel}
        {...(item.testID !== undefined ? { testID: item.testID } : {})}
      >
        {indicator}
      </Box>
    );
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={item.accessibilityLabel}
      onPress={item.onPress}
      feedback="none"
      {...(item.testID !== undefined ? { testID: item.testID } : {})}
    >
      {indicator}
    </Pressable>
  );
}

function StatusBarIndicatorRow({
  items,
}: {
  items: readonly RegisteredStatusBarItem[];
}): ReactNode {
  return (
    <Box
      pointerEvents="box-none"
      sx={{
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-end',
        paddingHorizontal: 10,
        gap: 2,
        zIndex: 1,
      }}
    >
      {items.map((item) => (
        <StatusBarIndicatorItem key={item.id} item={item} />
      ))}
    </Box>
  );
}

/**
 * Thin smartphone-style strip. Extends a themed fill through the system
 * safe-area, then lays indicator icons in a {@link STATUS_BAR_BODY_HEIGHT}
 * row. Swipe down drives reveal progress; press / activate also opens.
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
      <Box
        dataSet={{ component: 'StatusBar', ...dataSet }}
        sx={[
          {
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            zIndex: STATUS_BAR_Z_INDEX,
            height: totalHeight,
            paddingTop: topInset,
            backgroundColor: 'surface',
          },
          statusBarGrabCursor(isGrabbing),
        ]}
      >
        {/* Full-strip open target sits behind indicators (no nested Pressable). */}
        <StatusBarOpenTarget
          accessibilityLabel={accessibilityLabel}
          hoverCapable={hoverCapable}
          onOpen={onOpen}
          setHovered={setHovered}
        />
        <StatusBarIndicatorRow items={items} />
        {tintColor ? (
          <Box
            pointerEvents="none"
            sx={{ absoluteFill: true, backgroundColor: tintColor }}
          />
        ) : null}
      </Box>
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
