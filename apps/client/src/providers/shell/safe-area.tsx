import type { ReactNode } from 'react';
import {
  initialWindowMetrics,
  SafeAreaProvider,
} from 'react-native-safe-area-context';

/** Jest / web have no native insets until layout; without these, children never mount. */
const fallbackInitialMetrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
} as const;

export function AppSafeArea({ children }: { children: ReactNode }): ReactNode {
  return (
    <SafeAreaProvider
      initialMetrics={initialWindowMetrics ?? fallbackInitialMetrics}
    >
      {children}
    </SafeAreaProvider>
  );
}
