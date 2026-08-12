/**
 * Full-screen Control Center-style status overlay. Progress (0..1) drives
 * fade + a subtle vertical slide. Frosted glass lets content underneath
 * remain faintly visible. Dismiss via grabber pan or close.
 */

import type { ReactNode } from 'react';
import { useContext } from 'react';
import {
  GestureDetector,
  ScrollView as GHScrollView,
} from 'react-native-gesture-handler';
import Animated, {
  type SharedValue,
  useAnimatedStyle,
} from 'react-native-reanimated';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';

import { borderRadius, useTheme } from '../../theme';
import { Box } from '../box';
import { CloseIconButton } from '../close-icon-button';
import { statusBarGrabCursor } from './status-bar-cursor';
import { StatusBarFrostBackdrop } from './status-bar-frost-backdrop';
import { StatusBarPanel } from './status-bar-panel';
import type { RegisteredStatusBarItem } from './types';
import type { StatusBarReveal } from './use-status-bar-reveal';

const ZERO_INSETS = { top: 0, right: 0, bottom: 0, left: 0 };
const GRABBER_WIDTH = 36;
const GRABBER_HEIGHT = 5;
const GRABBER_HIT_HEIGHT = 56;
const CLOSE_SIZE = 44;
const CLOSE_INSET = 12;
/** Max width of the Control Center tile grid (phone-like on large screens). */
const PANEL_MAX_WIDTH = 400;
/** How far content rides with the pointer (px at progress 0 → 0 at progress 1). */
const CONTENT_SLIDE_PX = 36;

export type StatusBarOverlayProps = {
  items: readonly RegisteredStatusBarItem[];
  progress: SharedValue<number>;
  handlePan: StatusBarReveal['handlePan'];
  /** True while the grabber pan is held (web `grabbing` cursor). */
  isGrabbing: boolean;
  interactive: boolean;
  onRequestClose: () => void;
  accessibilityLabel: string;
};

function StatusBarBottomGrabber({
  handlePan,
  isGrabbing,
  themeBorder,
  bottomInset,
}: {
  handlePan: StatusBarReveal['handlePan'];
  isGrabbing: boolean;
  themeBorder: string;
  bottomInset: number;
}): ReactNode {
  return (
    <GestureDetector gesture={handlePan}>
      <Box
        accessibilityRole="adjustable"
        accessibilityLabel="Swipe up to close"
        sx={[
          {
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: GRABBER_HIT_HEIGHT,
            paddingTop: 14,
            alignSelf: 'stretch',
            paddingBottom: Math.max(bottomInset, 12),
          },
          statusBarGrabCursor(isGrabbing),
        ]}
      >
        <Box
          sx={{
            width: GRABBER_WIDTH,
            height: GRABBER_HEIGHT,
            borderRadius: borderRadius.full,
            backgroundColor: themeBorder,
          }}
        />
      </Box>
    </GestureDetector>
  );
}

export function StatusBarOverlay({
  items,
  progress,
  handlePan,
  isGrabbing,
  interactive,
  onRequestClose,
  accessibilityLabel,
}: StatusBarOverlayProps): ReactNode {
  const theme = useTheme();
  const insets = useContext(SafeAreaInsetsContext) ?? ZERO_INSETS;

  const surfaceStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
  }));

  // Content (not the frost fill) tracks the pointer with a short slide.
  const contentStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - progress.value) * -CONTENT_SLIDE_PX }],
  }));

  return (
    <Animated.View
      accessibilityViewIsModal={interactive}
      accessibilityLabel={accessibilityLabel}
      accessibilityActions={[{ name: 'escape' }]}
      onAccessibilityAction={(event) => {
        if (event.nativeEvent.actionName === 'escape') {
          onRequestClose();
        }
      }}
      pointerEvents={interactive ? 'auto' : 'none'}
      style={[
        {
          position: 'absolute',
          top: 0,
          right: 0,
          bottom: 0,
          left: 0,
          zIndex: 1,
        },
        surfaceStyle,
      ]}
    >
      <StatusBarFrostBackdrop colorScheme={theme.colorScheme} />
      <Animated.View style={[{ flex: 1 }, contentStyle]}>
        <Box
          pointerEvents="box-none"
          sx={{
            position: 'absolute',
            zIndex: 2,
            top: insets.top + CLOSE_INSET,
            right: CLOSE_INSET,
          }}
        >
          <CloseIconButton
            onPress={onRequestClose}
            size={CLOSE_SIZE}
            background="surfaceMuted"
          />
        </Box>
        <GHScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            paddingTop: insets.top + CLOSE_SIZE + CLOSE_INSET,
            paddingBottom: 12,
            paddingHorizontal: 16,
            flexGrow: 1,
            alignItems: 'center',
          }}
          bounces
          showsVerticalScrollIndicator={false}
        >
          <Box
            sx={{
              width: '100%',
              alignSelf: 'center',
              maxWidth: PANEL_MAX_WIDTH,
            }}
          >
            <StatusBarPanel items={items} />
          </Box>
        </GHScrollView>
        <StatusBarBottomGrabber
          handlePan={handlePan}
          isGrabbing={isGrabbing}
          themeBorder={theme.colors.border}
          bottomInset={insets.bottom}
        />
      </Animated.View>
    </Animated.View>
  );
}
