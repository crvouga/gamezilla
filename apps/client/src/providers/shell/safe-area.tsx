import type { ReactNode } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

export function AppSafeArea({ children }: { children: ReactNode }): ReactNode {
  return <SafeAreaProvider>{children}</SafeAreaProvider>;
}
