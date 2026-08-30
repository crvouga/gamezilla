/**
 * Shared helpers for status-bar reveal + dismiss gestures.
 * Nuclear overhaul: snap progress — no springs.
 */

import { runOnJS, type SharedValue } from 'react-native-reanimated';

/** Progress at which a release commits open (or close when dismissing). */
export const STATUS_BAR_COMMIT_PROGRESS = 0.35;

/** Velocity (px/s) that commits even below progress threshold. */
export const STATUS_BAR_COMMIT_VELOCITY = 500;

/** Cap on progress-units/s so a wild flick cannot explode. */
const MAX_PROGRESS_VELOCITY = 12;

export function clamp01(value: number): number {
  'worklet';
  return Math.min(1, Math.max(0, value));
}

/** Convert pixel/s pan velocity into progress-units/s. */
export function progressVelocityFromPixels(
  velocityY: number,
  revealDistance: number
): number {
  'worklet';
  if (revealDistance <= 0) return 0;
  const v = velocityY / revealDistance;
  return Math.max(-MAX_PROGRESS_VELOCITY, Math.min(MAX_PROGRESS_VELOCITY, v));
}

/** Snap progress to 0 or 1 and invoke onDone. */
export function springProgressTo(
  progress: SharedValue<number>,
  target: number,
  onDone: () => void,
  _velocity = 0
): void {
  'worklet';
  progress.value = target;
  runOnJS(onDone)();
}
