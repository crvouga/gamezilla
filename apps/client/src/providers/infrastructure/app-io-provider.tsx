/**
 * Composition-root I/O: wall clock, global HTTP, crypto ids.
 * Feature code must read these via context — never bare `fetch` / `Date.now`
 * / `crypto.randomUUID` in product client paths.
 */
import { ClockProvider } from '@pkgs/clock';
import { HttpClientProvider } from '@pkgs/http-client';
import { ComposeProviders } from '@pkgs/ui';
import { IdProvider } from '@pkgs/uuid';
import type { ReactNode } from 'react';

const ioProviders = [ClockProvider, HttpClientProvider, IdProvider];

export function AppIoProvider({
  children,
}: {
  readonly children: ReactNode;
}): ReactNode {
  return (
    <ComposeProviders providers={ioProviders}>{children}</ComposeProviders>
  );
}
