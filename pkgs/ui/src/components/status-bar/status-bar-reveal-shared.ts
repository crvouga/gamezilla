/**
 * Shared spring / clamp helpers for status-bar reveal + dismiss gestures.
 */

import { runOnJS, type SharedValue, withSpring } from 'react-native-reanimated';

/** Progress at which a release commits open (or close when dismissing). */
export const STATUS_BAR_COMMIT_PROGRESS = 0.35;

/** Velocity (px/s) that commits even below progress threshold. */
export const STATUS_BAR_COMMIT_VELOCITY = 500;

export const STATUS_BAR_REVEAL_SPRING = {
  damping: 28,
  stiffness: 320,
  overshootClamping: true,
} as const;

/** Cap on progress-units/s so a wild flick cannot explode the spring. */
const MAX_PROGRESS_VELOCITY = 12;

export function clamp01(value: number): number {
  'worklet';
  return Math.min(1, Math.max(0, value));
}

/** Convert pixel/s pan velocity into progress-units/s for {@link springProgressTo}. */
export function progressVelocityFromPixels(
  velocityY: number,
  revealDistance: number
): number {
  'worklet';
  if (revealDistance <= 0) return 0;
  const v = velocityY / revealDistance;
  return Math.max(-MAX_PROGRESS_VELOCITY, Math.min(MAX_PROGRESS_VELOCITY, v));
}

/**
 * Spring progress to 0 or 1. Pass gesture `velocity` (progress units/s) so a
 * fast flick finishes quickly and a slow release eases out.
 */
export function springProgressTo(
  progress: SharedValue<number>,
  target: number,
  onDone: () => void,
  velocity = 0
): void {
  'worklet';
  const speed = Math.abs(velocity);
  // Faster flicks get a snappier spring; slow releases keep the base feel.
  const stiffness =
    STATUS_BAR_REVEAL_SPRING.stiffness + Math.min(speed * 90, 560);
  const damping = STATUS_BAR_REVEAL_SPRING.damping + Math.min(speed * 4, 24);
  progress.value = withSpring(
    target,
    {
      ...STATUS_BAR_REVEAL_SPRING,
      stiffness,
      damping,
      velocity,
    },
    (finished) => {
      if (finished) {
        runOnJS(onDone)();
      }
    }
  );
}
