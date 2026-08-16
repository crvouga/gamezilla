import { SignInCapabilitiesProvider } from '@libs/auth/client/sign-in-capabilities-context';
import { useClientConfig } from '@libs/client-config/client/use-client-config';
import { useSyncEngine } from '@pkgs/sync-engine/client';
import type { ReactNode } from 'react';

/** Bridges synced `client_config` into auth sign-in method gating. */
export function AppSignInCapabilities({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  const { paintReady } = useSyncEngine();
  const { config, isLoading } = useClientConfig();
  return (
    <SignInCapabilitiesProvider
      value={{
        google: config.google_enabled,
        emailPassword: config.email_password_enabled,
        // Local watch can hydrate empty rows before session queries finish —
        // do not treat that as “server has no methods configured”.
        ready: paintReady && !isLoading,
      }}
    >
      {children}
    </SignInCapabilitiesProvider>
  );
}
