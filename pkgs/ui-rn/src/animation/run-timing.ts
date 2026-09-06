/**
 * Safe RN `Animated` helpers. Nuclear overhaul: theme motion durations are 0,
 * and `Animated.timing({ duration: 0 })` on react-native-web can recurse until
 * `RangeError: Maximum call stack size exceeded` (TimingAnimation → _flush →
 * AnimatedProps.update). Snap with `setValue` instead.
 */

import { Animated, type EasingFunction } from 'react-native';

export type TimingToConfig = {
  toValue: number;
  duration: number;
  easing?: EasingFunction;
  useNativeDriver: boolean;
};

type Stoppable = { stop: () => void };

function finishedCallback(callback?: Animated.EndCallback): void {
  callback?.({ finished: true });
}

/**
 * Like `Animated.timing(value, config).start(cb)`, but snaps when
 * `duration <= 0` so zero-motion tokens never start a TimingAnimation.
 */
export function startTiming(
  value: Animated.Value,
  config: TimingToConfig,
  callback?: Animated.EndCallback
): Stoppable {
  if (config.duration <= 0) {
    value.setValue(config.toValue);
    finishedCallback(callback);
    return { stop: () => undefined };
  }
  const animation = Animated.timing(value, config);
  animation.start(callback);
  return animation;
}

/**
 * Snap immediately (nuclear overhaul: springs are deleted; callers that used
 * to spring should call this).
 */
export function snapAnimatedValue(
  value: Animated.Value,
  toValue: number
): void {
  value.setValue(toValue);
}
