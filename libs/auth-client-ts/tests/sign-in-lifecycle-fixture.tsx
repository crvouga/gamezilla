import { AuthClientProvider } from '@libs/auth-client-ts/auth-client-provider';
import { useSignInPending } from '@libs/auth-client-ts/sign-in-pending';
import {
  type UseSignInModalLifecycleResult,
  useSignInModalLifecycle,
} from '@libs/auth-client-ts/use-sign-in-modal-lifecycle';
import {
  SESSION_TOKEN_KEY,
  SIGN_IN_PENDING_KEY,
} from '@libs/auth-shared-ts/auth-storage-keys';
import type { AuthClientPort } from '@pkgs/auth-root-shared-ts/auth-client-port';
import {
  AUTH_SESSION_INITIAL,
  type AuthSessionState,
} from '@pkgs/auth-root-shared-ts/auth-session-state';
import { ClockProvider } from '@pkgs/clock-client-ts/solid';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import { SecureStorageStoreProvider } from '@pkgs/secure-storage-root-client-ts/solid';
import { createInMemorySecureStorage } from '@pkgs/secure-storage-root-shared-ts/impl-memory';
import { createSecureStorageStore } from '@pkgs/secure-storage-root-shared-ts/secure-storage-store';
import { MemoryRouter } from '@solidjs/router';
import { render } from '@solidjs/testing-library';

export async function signInLifecycleFixture() {
  const time = createHarnessClock();
  const store = createSecureStorageStore(createInMemorySecureStorage());
  await store.write(
    SIGN_IN_PENDING_KEY,
    JSON.stringify({
      startedAt: '1970-01-01T00:00:00.000Z',
      returnHref: '/more/account',
    })
  );
  await store.hydrate(SESSION_TOKEN_KEY);
  let state: AuthSessionState = AUTH_SESSION_INITIAL;
  const listeners = new Set<() => void>();
  const publish = (next: AuthSessionState) => {
    state = next;
    for (const listener of listeners) listener();
  };
  const unused = async (): Promise<never> => {
    throw new Error('Unexpected auth operation');
  };
  const port: AuthClientPort = {
    provider: 'callback-fixture',
    signIn: unused,
    requestEmailLink: unused,
    signInWithEmailLink: unused,
    signOut: unused,
    signOutEverywhere: unused,
    listIdentities: unused,
    prepareLink: unused,
    linkProvider: unused,
    unlinkProvider: unused,
    createSeparateAccount: unused,
    getFreshToken: unused,
    session: {
      getSnapshot: () => state,
      subscribe: (listener: () => void) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
      refresh: async () => {},
    },
  };
  let lifecycle!: UseSignInModalLifecycleResult;
  function Probe() {
    const pending = useSignInPending();
    lifecycle = useSignInModalLifecycle({
      resumePending: () => pending.isHydrated() && pending.pending() !== null,
    });
    return null;
  }
  const view = render(() => (
    <MemoryRouter
      root={() => (
        <ClockProvider clock={time.clock} timers={time.timers}>
          <SecureStorageStoreProvider value={store}>
            <AuthClientProvider port={port}>
              <Probe />
            </AuthClientProvider>
          </SecureStorageStoreProvider>
        </ClockProvider>
      )}
    />
  ));
  return { time, store, publish, lifecycle, dispose: view.unmount };
}
