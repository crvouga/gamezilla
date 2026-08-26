import { type ReactNode, Suspense } from 'react';

import { ThemedBlankShell } from './blank-shell';

export function AppSuspenseRoot({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  return <Suspense fallback={<ThemedBlankShell />}>{children}</Suspense>;
}
