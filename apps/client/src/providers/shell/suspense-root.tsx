import { LoadingState } from '@pkgs/ui';
import { type ReactNode, Suspense } from 'react';

export function AppSuspenseRoot({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  return (
    <Suspense fallback={<LoadingState size="large" />}>{children}</Suspense>
  );
}
