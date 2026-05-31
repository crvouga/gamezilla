/**
 * `MutationStateTransition` -- animates the swap between mutation phases.
 *
 * The container height animates to the natural height of whatever phase is
 * currently mounted (so the dialog grows / shrinks smoothly), while the phase
 * content cross-fades in whenever `stateKey` changes. Content for the *same*
 * key (e.g. live form input) updates instantly without re-triggering the fade.
 */

import { useEffect, useRef, type ReactNode } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

const HEIGHT_DURATION_MS = 240;
const FADE_DURATION_MS = 200;
const EASE = Easing.out(Easing.cubic);

export function MutationStateTransition({
  stateKey,
  active,
  children,
}: {
  stateKey: string;
  /** When false (surface closed), drop the cached height so the next open
   * snaps to its content instead of animating from a stale phase height. */
  active: boolean;
  children: ReactNode;
}): ReactNode {
  const opacity = useSharedValue(1);
  const height = useSharedValue<number | undefined>(undefined);
  const measured = useRef(false);

  useEffect(() => {
    if (!active) {
      measured.current = false;
    }
  }, [active]);

  useEffect(() => {
    opacity.value = 0;
    opacity.value = withTiming(1, {
      duration: FADE_DURATION_MS,
      easing: EASE,
    });
  }, [stateKey, opacity]);

  const onContentLayout = (event: LayoutChangeEvent): void => {
    const next = event.nativeEvent.layout.height;
    if (next <= 0) return;
    if (!measured.current) {
      height.value = next;
      measured.current = true;
      return;
    }
    height.value = withTiming(next, {
      duration: HEIGHT_DURATION_MS,
      easing: EASE,
    });
  };

  const containerStyle = useAnimatedStyle(() => ({ height: height.value }));
  const contentStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View style={[containerStyle, { overflow: 'hidden' }]}>
      <Animated.View style={contentStyle}>
        <View onLayout={onContentLayout}>{children}</View>
      </Animated.View>
    </Animated.View>
  );
}
