import type { AuthClientPort } from '@pkgs/auth-root-shared/auth-client-port';
import type { AuthSessionStore } from '@pkgs/auth-root-shared/auth-session-state';
import type { OfflineNetworkController } from './offline-network-controller';
import { offlineNetworkError } from './offline-network-http';

function offlineSession(
  offline: OfflineNetworkController,
  inner: AuthSessionStore
): AuthSessionStore {
  return {
    getSnapshot: inner.getSnapshot,
    subscribe: inner.subscribe,
    refresh: () =>
      offline.isOffline()
        ? Promise.reject(offlineNetworkError())
        : inner.refresh(),
  };
}

/** Auth SDKs own hidden HTTP and provider navigation, so gate their whole port. */
export function createOfflineAuthClient(
  offline: OfflineNetworkController,
  inner: AuthClientPort
): AuthClientPort {
  const requireOnline = async <T>(work: () => Promise<T>): Promise<T> => {
    if (offline.isOffline()) throw offlineNetworkError();
    return await work();
  };
  return {
    provider: inner.provider,
    session: offlineSession(offline, inner.session),
    signIn: (provider, options) =>
      requireOnline(() => inner.signIn(provider, options)),
    signInWithPassword: (email, password, options) =>
      requireOnline(() => inner.signInWithPassword(email, password, options)),
    registerWithPassword: (email, password) =>
      requireOnline(() => inner.registerWithPassword(email, password)),
    signOut: () => requireOnline(() => inner.signOut()),
    signOutEverywhere: () => requireOnline(() => inner.signOutEverywhere()),
    listIdentities: () => requireOnline(() => inner.listIdentities()),
    prepareLink: () => requireOnline(() => inner.prepareLink()),
    linkProvider: (provider) =>
      requireOnline(() => inner.linkProvider(provider)),
    unlinkProvider: (provider) =>
      requireOnline(() => inner.unlinkProvider(provider)),
    createSeparateAccount: (token) =>
      requireOnline(() => inner.createSeparateAccount(token)),
    getFreshToken: (options) => {
      if (offline.isOffline() && options?.skipCache === true) {
        return Promise.reject(offlineNetworkError());
      }
      return inner.getFreshToken(options);
    },
    ...(inner.completeHostedAuthRedirect === undefined
      ? {}
      : {
          completeHostedAuthRedirect: () =>
            requireOnline(() => inner.completeHostedAuthRedirect!()),
        }),
  };
}
