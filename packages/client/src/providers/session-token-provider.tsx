import { SessionTokenProvider } from '@gamezilla/auth/client/session-token-context';
import type { ReactNode } from 'react';

export function SessionTokenProviderWrapper({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  return <SessionTokenProvider>{children}</SessionTokenProvider>;
}
