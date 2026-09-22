import { AuthClientProvider } from '@libs/auth/public/auth-client-provider';
import { AuthBridge } from '@libs/auth/root/client/auth-bridge';
import { createAuthClientAdapter } from '@pkgs/auth/client';
import type { JSX } from 'solid-js';

import { useClientEnv } from '../client-env-context';
import { LocalIdentityProvider } from '../identity/identity-context';

export function AppAuthProvider(props: {
  readonly children: JSX.Element;
}): JSX.Element {
  const env = useClientEnv();
  const port = createAuthClientAdapter({
    baseURL: env.authBaseURL,
    clock: env.clock,
    timers: env.timers,
    fetch: env.server,
    storage: env.authStorage,
    openAuthSession: env.openAuthSession,
    callbackUrl: env.authCallbackUrl,
  });
  return (
    <AuthClientProvider port={port}>
      <AuthBridge>
        <LocalIdentityProvider>{props.children}</LocalIdentityProvider>
      </AuthBridge>
    </AuthClientProvider>
  );
}
