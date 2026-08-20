import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

/** Props for {@link ClientEnv.gestureRoot} (wall RNGH root or sim View). */
export type GestureRootProps = {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};
