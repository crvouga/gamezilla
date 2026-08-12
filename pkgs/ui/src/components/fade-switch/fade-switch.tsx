/**
 * `FadeSwitch` -- sequential opacity fade when `stateKey` changes.
 *
 * Native: fade out → swap mounted children → fade in (single child at a time).
 * Web: instant swap (no Reanimated work). Skips animation on first mount so
 * nested switches do not double-fade.
 */

import type { ReactNode } from 'react';
import { Platform } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

import type { ComponentDataSet } from '../../component-id';
import { Box } from '../box';
import { useFadeMachine } from './use-fade-machine';

const ROOT_SX = { flex: 1, minHeight: 0 } as const;

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
      <Box sx={ROOT_SX} dataSet={{ component: 'FadeSwitch', ...dataSet }}>
        {children}
      </Box>
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
    <Box sx={ROOT_SX} dataSet={{ component: 'FadeSwitch', ...dataSet }}>
      <Animated.View style={[{ flex: 1, minHeight: 0 }, style]}>
        {content}
      </Animated.View>
    </Box>
  );
}
