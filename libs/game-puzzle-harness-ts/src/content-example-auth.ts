import type { AuthClientPort } from '@pkgs/auth-root-shared-ts/auth-client-port';

/** The reference app keeps device identities; provider sign-in belongs to the auth example. */
export function contentExampleAuth(): AuthClientPort {
  const outsideExample = () =>
    Promise.reject(
      new Error('Identity changes are outside the puzzle reference app')
    );
  return {
    provider: 'puzzle-reference',
    session: {
      getSnapshot: () => ({ isHydrated: true, error: null, session: null }),
      subscribe: () => () => undefined,
      refresh: () => Promise.resolve(),
    },
    signIn: outsideExample,
    requestEmailLink: outsideExample,
    signInWithEmailLink: outsideExample,
    signOut: outsideExample,
    signOutEverywhere: outsideExample,
    listIdentities: outsideExample,
    prepareLink: outsideExample,
    linkProvider: outsideExample,
    unlinkProvider: outsideExample,
    createSeparateAccount: outsideExample,
    getFreshToken: () => Promise.resolve(null),
  };
}
