/**
 * Full-screen Control Center-style status overlay. Progress (0..1) drives
 * fade + a subtle vertical slide that tracks the open/close gesture.
 * Dismiss via bottom grabber pan (swipe up) or close button.
 */

import type { ReactNode } from 'react';
import { useContext } from 'react';
import { StyleSheet, View } from 'react-native';
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
import { CloseIconButton } from '../close-icon-button';
import { statusBarGrabCursor } from './status-bar-cursor';
import { StatusBarPanel } from './status-bar-panel';
import type { RegisteredStatusBarItem } from './types';
import type { StatusBarReveal } from './use-status-bar-reveal';

const ZERO_INSETS = { top: 0, right: 0, bottom: 0, left: 0 };
const GRABBER_WIDTH = 36;
const GRABBER_HEIGHT = 5;
const GRABBER_HIT_HEIGHT = 56;
const CLOSE_SIZE = 48;
const CLOSE_INSET = 12;
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
      <View
        accessibilityRole="adjustable"
        accessibilityLabel="Swipe up to close"
        style={[
          styles.grabberBar,
          { paddingBottom: Math.max(bottomInset, 12) },
          statusBarGrabCursor(isGrabbing),
        ]}
      >
        <View style={[styles.grabber, { backgroundColor: themeBorder }]} />
      </View>
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

  // Content (not the full-bleed fill) tracks the pointer with a short slide.
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
        styles.root,
        { backgroundColor: theme.colors.surfaceElevated },
        surfaceStyle,
      ]}
    >
      <Animated.View style={[styles.content, contentStyle]}>
        <View
          pointerEvents="box-none"
          style={[
            styles.closeWrap,
            { top: insets.top + CLOSE_INSET, right: CLOSE_INSET },
          ]}
        >
          <CloseIconButton
            onPress={onRequestClose}
            size={CLOSE_SIZE}
            background="surfaceMuted"
          />
        </View>
        <GHScrollView
          style={styles.scroll}
          contentContainerStyle={{
            paddingTop: insets.top + CLOSE_SIZE + CLOSE_INSET * 2,
            paddingBottom: 16,
            paddingHorizontal: 16,
            flexGrow: 1,
          }}
          bounces
          showsVerticalScrollIndicator
        >
          <StatusBarPanel items={items} />
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

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
  },
  content: {
    flex: 1,
  },
  closeWrap: {
    position: 'absolute',
    zIndex: 2,
  },
  scroll: {
    flex: 1,
  },
  grabberBar: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: GRABBER_HIT_HEIGHT,
    paddingTop: 14,
    alignSelf: 'stretch',
  },
  grabber: {
    width: GRABBER_WIDTH,
    height: GRABBER_HEIGHT,
    borderRadius: borderRadius.full,
  },
});
