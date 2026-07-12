/**
 * `FadeSwitch` -- sequential opacity fade when `stateKey` changes.
 *
 * Native: fade out → swap mounted children → fade in (single child at a time).
 * Web: instant swap (no Reanimated work). Skips animation on first mount so
 * nested switches do not double-fade.
 */

import type { ReactNode } from 'react';
import { Platform, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

import { useFadeMachine } from './use-fade-machine';

const styles = StyleSheet.create({
  root: { flex: 1, minHeight: 0 },
});

export type FadeSwitchProps = {
  stateKey: string;
  children: ReactNode;
};

export function FadeSwitch({
  stateKey,
  children,
}: FadeSwitchProps): ReactNode {
  if (Platform.OS === 'web') {
    return children;
  }
  return (
    <NativeFadeSwitch stateKey={stateKey}>{children}</NativeFadeSwitch>
  );
}

function NativeFadeSwitch({
  stateKey,
  children,
}: FadeSwitchProps): ReactNode {
  const { content, opacity } = useFadeMachine(stateKey, children);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View style={[styles.root, style]}>{content}</Animated.View>
  );
}
