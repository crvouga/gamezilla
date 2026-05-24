import { SpinnerBox } from '@pkgs/ui';
import { Suspense, type ReactNode } from 'react';

export function SuspenseRootProvider({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  return (
    <Suspense fallback={<SpinnerBox sx={{ flex: 1 }} />}>{children}</Suspense>
  );
}
