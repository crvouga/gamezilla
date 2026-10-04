/** @jsxImportSource solid-js */
import { SignInCapabilitiesProvider } from '@libs/auth-client/sign-in-capabilities-context';
import { useClientConfig } from '@libs/app-config-client/use-client-config';
import type { JSX } from 'solid-js';
import { resolveSignInCapabilitiesReady } from '@libs/app-shared/resolve-sign-in-capabilities-ready';

/**
 * Bridges synced `client_config` into auth sign-in method gating. Must render
 * under the identity-scoped sync engine (`useClientConfig` reads local
 * SQLite) and above `AuthModalsProvider`.
 */
export function AppSignInCapabilities(props: {
  readonly children: JSX.Element;
}): JSX.Element {
  const clientConfig = useClientConfig();
  return (
    <SignInCapabilitiesProvider
      value={{
        get google() {
          return clientConfig.config().google_enabled;
        },
        get apple() {
          return clientConfig.config().apple_enabled;
        },
        // Unlock when methods appear in synced rows, or when any client_config
        // rows have hydrated (definitive empty/disabled). Never unlock on bare
        // paintReady + empty defaults — that is the pre-hydrate stuck state.
        get ready() {
          return resolveSignInCapabilitiesReady({
            isLoading: clientConfig.isLoading(),
            methodsKnown:
              clientConfig.config().google_enabled ||
              clientConfig.config().apple_enabled,
            configRowCount: clientConfig.rows().length,
          });
        },
      }}
    >
      {props.children}
    </SignInCapabilitiesProvider>
  );
}
