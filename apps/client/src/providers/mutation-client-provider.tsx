import { MutationClientProvider as AuthMutationClientProvider } from '@libs/auth/public/mutation-client-provider';
import type { ReactNode } from 'react';

import { APP_MUTATIONS } from '../sync/app-mutations';

export function MutationClientProvider({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  return (
    <AuthMutationClientProvider registry={APP_MUTATIONS}>
      {children}
    </AuthMutationClientProvider>
  );
}
