import type { ReactNode } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

export function GestureHandlerProvider({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  return (
    <GestureHandlerRootView style={{ flex: 1 }} testID="app-root">
      {children}
    </GestureHandlerRootView>
  );
}
