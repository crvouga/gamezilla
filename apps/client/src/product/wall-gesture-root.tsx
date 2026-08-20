// @io-wall-ok — Expo GestureHandlerRootView for wall ClientEnv.

import type { GestureRootProps } from '@apps/client/product/gesture-root-props';
import type { ReactElement } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

export function WallGestureRoot({
  children,
  style,
  testID,
}: GestureRootProps): ReactElement {
  return (
    <GestureHandlerRootView style={style} testID={testID}>
      {children}
    </GestureHandlerRootView>
  );
}
