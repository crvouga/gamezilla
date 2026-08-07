import type { ReactNode } from 'react';
import { useContext, useMemo } from 'react';
import { View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';

import { type ComponentDataSet, componentDataSet } from '../../component-id';
import { useTheme } from '../../theme';
import { Box } from '../box';
import type { RegisteredStatusBarItem } from './types';

/** Body height of the thin strip (excluding safe-area inset). */
export const STATUS_BAR_BODY_HEIGHT = 22;

/** z-index below surfaces/banners so modals still cover the strip. */
const STATUS_BAR_Z_INDEX = 1000;

/** Downward travel (px) required to open after the pan ends. */
const OPEN_TRANSLATION_Y = 24;

/** Downward velocity (px/s) that opens even with less travel. */
const OPEN_VELOCITY_Y = 500;

const ZERO_INSETS = { top: 0, right: 0, bottom: 0, left: 0 };

export type StatusBarStripProps = {
  items: readonly RegisteredStatusBarItem[];
  /** Called when the user swipes down (or activates via accessibility). */
  onOpen: () => void;
  accessibilityLabel: string;
  dataSet?: ComponentDataSet;
};

/**
 * Thin smartphone-style strip. Extends a themed fill through the system
 * safe-area (so the notch / status-bar zone matches dark/light), then lays
 * indicator icons in a {@link STATUS_BAR_BODY_HEIGHT} row below that inset.
 * Swipe down opens the panel (tap does not). The chrome wrapper must push
 * content by {@link useStatusBarPushHeight} so TopBar is not covered by the
 * body row (TopBar / ScreenBase still own the safe-area inset themselves).
 */
export function StatusBarStrip({
  items,
  onOpen,
  accessibilityLabel,
  dataSet,
}: StatusBarStripProps): ReactNode {
  const theme = useTheme();
  const insets = useContext(SafeAreaInsetsContext) ?? ZERO_INSETS;
  const topInset = insets.top;
  const totalHeight = topInset + STATUS_BAR_BODY_HEIGHT;

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetY(10)
        .failOffsetX([-20, 20])
        .onEnd((e) => {
          if (
            e.translationY >= OPEN_TRANSLATION_Y ||
            e.velocityY >= OPEN_VELOCITY_Y
          ) {
            runOnJS(onOpen)();
          }
        }),
    [onOpen]
  );

  return (
    <GestureDetector gesture={pan}>
      <View
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
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          zIndex: STATUS_BAR_Z_INDEX,
          height: totalHeight,
          paddingTop: topInset,
          backgroundColor: theme.colors.surface,
        }}
      >
        <View
          style={{
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'flex-end',
            paddingHorizontal: 10,
            gap: 8,
            backgroundColor: theme.colors.surface,
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
      </View>
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
