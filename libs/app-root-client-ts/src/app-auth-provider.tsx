import { AuthBridge } from '@libs/auth-client-ts/auth-bridge';
import { AuthClientProvider } from '@libs/auth-client-ts/auth-client-provider';
import type { JSX } from 'solid-js';

import { useClientEnv, useSyncEnginePool } from './client-env-context';
import { LocalIdentityProvider } from './identity-context';

export function AppAuthProvider(props: {
  readonly children: JSX.Element;
}): JSX.Element {
  const env = useClientEnv();
  const pool = useSyncEnginePool();
  // An account's local data is its own database; an engine that is not open
  // has nothing it could still share from here.
  const countUnshared = async (accountId: string): Promise<number | null> => {
    const engine = pool.peekReady(
      env.resolveDatabaseName({ userId: accountId })
    );
    return engine === null ? null : engine.pendingMutationCount();
  };
  return (
    <AuthClientProvider port={env.createAuthClient(env.server)}>
      <AuthBridge countUnshared={countUnshared}>
        <LocalIdentityProvider>{props.children}</LocalIdentityProvider>
      </AuthBridge>
    </AuthClientProvider>
  );
}
