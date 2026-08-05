import { ClerkProvider } from '@clerk/expo';
import { resourceCache } from '@clerk/expo/resource-cache';
import { tokenCache } from '@clerk/expo/token-cache';
import type { ReactNode } from 'react';

import { ClerkAuthSync } from './clerk-auth-sync';

export type ClerkAuthProviderConfig = {
  readonly publishableKey: string;
};

export type ClerkAuthProviderProps = {
  readonly config: ClerkAuthProviderConfig;
  readonly children: ReactNode;
};

export function ClerkAuthProvider({
  config,
  children,
}: ClerkAuthProviderProps): ReactNode {
  const providerProps =
    tokenCache === undefined
      ? { publishableKey: config.publishableKey }
      : {
          publishableKey: config.publishableKey,
          tokenCache,
          __experimental_resourceCache: resourceCache,
        };

  return (
    <ClerkProvider {...providerProps}>
      <ClerkAuthSync />
      {children}
    </ClerkProvider>
  );
}
