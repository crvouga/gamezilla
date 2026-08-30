import { SignInCapabilitiesProvider } from '@libs/auth/public/sign-in-capabilities-context';
import { useClientConfig } from '@libs/client-config/public/use-client-config';
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
  const methodsKnown = config.dev_oauth_enabled || config.google_enabled;
  return (
    <SignInCapabilitiesProvider
      value={{
        google: config.google_enabled,
        devOauth: config.dev_oauth_enabled,
        // Local watch can hydrate empty rows before session queries finish —
        // do not treat that as “server has no methods configured”. Once synced
        // rows enable a method, unlock the picker without waiting on full
        // paintReady (second sim actors often lag behind).
        ready: !isLoading && (paintReady || methodsKnown),
      }}
    >
      {children}
    </SignInCapabilitiesProvider>
  );
}
