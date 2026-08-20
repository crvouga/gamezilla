import type { ReactElement } from 'react';
import { View } from 'react-native';

import type { GestureRootProps } from './gesture-root-props';

/** Sim / DST gesture root — flex View, no RNGH native install. */
export function SimGestureRoot({
  children,
  style,
  testID,
}: GestureRootProps): ReactElement {
  return (
    <View style={style} testID={testID} collapsable={false}>
      {children}
    </View>
  );
}
