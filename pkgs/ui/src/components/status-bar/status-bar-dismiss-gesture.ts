/**
 * Always-on bottom-grabber dismiss pan (not scroll-gated).
 * Swipe up on the grabber to close — mirrors the strip’s swipe-down open,
 * and stays usable at the bottom edge of the viewport (downward pans are
 * often swallowed by overscroll there).
 */

import { Gesture } from 'react-native-gesture-handler';
import { runOnJS, type SharedValue } from 'react-native-reanimated';

import {
  clamp01,
  progressVelocityFromPixels,
  STATUS_BAR_COMMIT_PROGRESS,
  STATUS_BAR_COMMIT_VELOCITY,
  springProgressTo,
} from './status-bar-reveal-shared';

export type CreateStatusBarHandlePanArgs = {
  progress: SharedValue<number>;
  revealDistance: number;
  handleOpened: () => void;
  handleClosed: () => void;
  setGrabbing: (grabbing: boolean) => void;
};

/** Upward pan on the bottom grabber — always available while open. */
export function createStatusBarHandlePan({
  progress,
  revealDistance,
  handleOpened,
  handleClosed,
  setGrabbing,
}: CreateStatusBarHandlePanArgs): ReturnType<typeof Gesture.Pan> {
  return Gesture.Pan()
    .activeOffsetY(-10)
    .failOffsetX([-20, 20])
    .onBegin(() => {
      runOnJS(setGrabbing)(true);
    })
    .onUpdate((e) => {
      // Finger up (negative translationY) → progress drops; panel follows.
      progress.value = clamp01(1 + e.translationY / revealDistance);
    })
    .onEnd((e) => {
      const velocity = progressVelocityFromPixels(e.velocityY, revealDistance);
      const shouldClose =
        progress.value <= 1 - STATUS_BAR_COMMIT_PROGRESS ||
        e.velocityY <= -STATUS_BAR_COMMIT_VELOCITY;
      if (shouldClose) {
        springProgressTo(progress, 0, handleClosed, velocity);
      } else {
        springProgressTo(progress, 1, handleOpened, velocity);
      }
    })
    .onFinalize(() => {
      runOnJS(setGrabbing)(false);
    });
}
