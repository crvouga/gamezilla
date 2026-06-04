import { LoadingState } from '@pkgs/ui';
import { Suspense, type ReactNode } from 'react';

export function SuspenseRootProvider({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  return (
    <Suspense fallback={<LoadingState size="large" />}>{children}</Suspense>
  );
}
