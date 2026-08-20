import { useClientEnv } from '@apps/client/product/client-env-provider';
import type { ReactNode } from 'react';

export function AppGestureHandler({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  const { gestureRoot: GestureRoot } = useClientEnv();
  return (
    <GestureRoot style={{ flex: 1 }} testID="app-root">
      {children}
    </GestureRoot>
  );
}
