import { sharePendingSignupUsername } from '@libs/auth-shared/pending-signup-username';
import type { AuthClientPort } from '@pkgs/auth-root-shared/auth-client-port';
import type { AuthSessionStore } from '@pkgs/auth-root-shared/auth-session-state';
import { HttpNetworkError } from '@pkgs/http-client-shared/http-network-error';
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

/**
 * Auth SDKs own hidden HTTP and provider navigation, so gate their whole port.
 * `waitUntilConnectable` resolves once the server has answered (or rejects when
 * it will not); the sign-in callback waits on it.
 */
export function createOfflineAuthClient(
  offline: OfflineNetworkController,
  inner: AuthClientPort,
  canConnect: () => boolean,
  waitUntilConnectable: () => Promise<void>
): AuthClientPort {
  const requireOnline = async <T>(work: () => Promise<T>): Promise<T> => {
    if (offline.isOffline()) throw offlineNetworkError();
    if (!canConnect())
      throw new HttpNetworkError(
        'This choice needs a connection. Work online or wait for the connection to return.'
      );
    return await work();
  };
  const client: AuthClientPort = {
    provider: inner.provider,
    session: offlineSession(offline, inner.session),
    signIn: (provider, options) =>
      requireOnline(() => inner.signIn(provider, options)),
    requestEmailLink: (email, options) =>
      requireOnline(() => inner.requestEmailLink(email, options)),
    signInWithEmailLink: (link) =>
      requireOnline(() => inner.signInWithEmailLink(link)),
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
          // The callback screen opens before the first health probe has
          // answered, so `canConnect()` is false on a cold start. Refusing
          // there would drop the person's one-time code and leave them signed
          // out with no error. Wait for the server, then exchange the code;
          // a server that never answers fails the exchange itself, which the
          // auth session publishes.
          completeHostedAuthRedirect: async () => {
            if (offline.isOffline()) throw offlineNetworkError();
            if (!canConnect())
              await waitUntilConnectable().catch(() => undefined);
            return await inner.completeHostedAuthRedirect!();
          },
        }),
  };
  // A signup handle left with the wrapped client is this client's to take.
  sharePendingSignupUsername(client, inner);
  return client;
}
