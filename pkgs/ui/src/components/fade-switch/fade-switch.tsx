/**
 * `FadeSwitch` -- sequential opacity fade when `stateKey` changes.
 *
 * Native: fade out → swap mounted children → fade in (single child at a time).
 * Web: instant swap (no Reanimated work). Skips animation on first mount so
 * nested switches do not double-fade.
 */

import type { ReactNode } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

import {
  componentDataSet,
  type ComponentDataSet,
} from '../../component-id';
import { useFadeMachine } from './use-fade-machine';

const styles = StyleSheet.create({
  root: { flex: 1, minHeight: 0 },
});

export type FadeSwitchProps = {
  stateKey: string;
  children: ReactNode;
  /** Web DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet;
};

export function FadeSwitch({
  stateKey,
  children,
  dataSet,
}: FadeSwitchProps): ReactNode {
  if (Platform.OS === 'web') {
    return (
      <View style={styles.root} {...componentDataSet('FadeSwitch', dataSet)}>
        {children}
      </View>
    );
  }
  return (
    <NativeFadeSwitch stateKey={stateKey} {...(dataSet ? { dataSet } : {})}>
      {children}
    </NativeFadeSwitch>
  );
}

function NativeFadeSwitch({
  stateKey,
  children,
  dataSet,
}: FadeSwitchProps): ReactNode {
  const { content, opacity } = useFadeMachine(stateKey, children);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      style={[styles.root, style]}
      {...componentDataSet('FadeSwitch', dataSet)}
    >
      {content}
    </Animated.View>
  );
}
