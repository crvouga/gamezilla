import { SignInCapabilitiesProvider } from '@libs/auth/client/sign-in-capabilities-context';
import { useClientConfig } from '@libs/client-config/client/use-client-config';
import type { ReactNode } from 'react';

/** Bridges synced `client_config` into auth sign-in method gating. */
export function AppSignInCapabilities({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  const { config, isLoading } = useClientConfig();
  return (
    <SignInCapabilitiesProvider
      value={{
        google: config.google_enabled,
        emailPassword: config.email_password_enabled,
        ready: !isLoading,
      }}
    >
      {children}
    </SignInCapabilitiesProvider>
  );
}
