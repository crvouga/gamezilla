import { SignInCapabilitiesProvider } from '@libs/auth/public/sign-in-capabilities-context';
import { useClientConfig } from '@libs/client-config/public/use-client-config';
import type { ReactNode } from 'react';
import { resolveSignInCapabilitiesReady } from './resolve-sign-in-capabilities-ready';

/** Bridges synced `client_config` into auth sign-in method gating. */
export function AppSignInCapabilities({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  const { config, isLoading, rows } = useClientConfig();
  const methodsKnown = config.dev_oauth_enabled || config.google_enabled;
  return (
    <SignInCapabilitiesProvider
      value={{
        google: config.google_enabled,
        devOauth: config.dev_oauth_enabled,
        // Unlock when methods appear in synced rows, or when any client_config
        // rows have hydrated (definitive empty/disabled). Never unlock on bare
        // paintReady + empty defaults — that is the pre-hydrate stuck state.
        ready: resolveSignInCapabilitiesReady({
          isLoading,
          methodsKnown,
          configRowCount: rows.length,
        }),
      }}
    >
      {children}
    </SignInCapabilitiesProvider>
  );
}
