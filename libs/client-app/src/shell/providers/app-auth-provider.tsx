import { AuthClientProvider } from '@libs/auth/public/auth-client-provider';
import { AuthBridge } from '@libs/auth/root/client/auth-bridge';
import type { JSX } from 'solid-js';

import { useClientEnv } from '../client-env-context';
import { LocalIdentityProvider } from '../identity/identity-context';

export function AppAuthProvider(props: {
  readonly children: JSX.Element;
}): JSX.Element {
  const env = useClientEnv();
  return (
    <AuthClientProvider port={env.createAuthClient()}>
      <AuthBridge>
        <LocalIdentityProvider>{props.children}</LocalIdentityProvider>
      </AuthBridge>
    </AuthClientProvider>
  );
}
