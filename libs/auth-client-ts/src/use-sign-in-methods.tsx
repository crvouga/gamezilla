import { useLingui } from '@lingui/solid/macro';
import type {
  OauthProviderId,
  SignInMethodId,
} from '@pkgs/auth-root-shared-ts/sign-in-method';
import { isOauthProviderId } from '@pkgs/auth-root-shared-ts/sign-in-method';
import { useLogger } from '@pkgs/logger-client-ts/solid';
import {
  type Accessor,
  createEffect,
  createMemo,
  createSignal,
  on,
} from 'solid-js';
import { useAuthClientPort } from './auth-client-provider';
import { authFlowErrorMessage } from './auth-flow-messages';
import { useSignInCapabilities } from './sign-in-capabilities-context';
import type { SignInMethodsView } from './sign-in-methods-section';
import { useFirstSyncFailed } from './use-first-sync-failed';
import { useIdentityRefresh } from './use-identity-refresh';
import { useLinkedIdentities } from './use-linked-identities';

function asError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

export type SignInMethods = {
  readonly view: Accessor<SignInMethodsView>;
  readonly removing: Accessor<SignInMethodId | null>;
  readonly connect: (provider: OauthProviderId) => Promise<void>;
  readonly remove: (method: SignInMethodId) => void;
  readonly cancelRemove: () => void;
  readonly confirmRemove: () => Promise<void>;
};

/**
 * The signed-in account's sign-in methods and the port calls that connect or
 * remove one. Failures reject with the message the screen shows.
 */
export function useSignInMethods(signedIn: Accessor<boolean>): SignInMethods {
  const { i18n } = useLingui();
  const capabilities = useSignInCapabilities();
  const port = useAuthClientPort();
  const linked = useLinkedIdentities();
  const syncFailed = useFirstSyncFailed();
  const refresh = useIdentityRefresh();
  const log = useLogger('auth-unlink');
  const [removing, setRemoving] = createSignal<SignInMethodId | null>(null);
  const providers = createMemo<readonly OauthProviderId[]>(() => {
    const enabled = [
      ...(capabilities.google ? (['google'] as const) : []),
      ...(capabilities.apple ? (['apple'] as const) : []),
    ];
    // A method linked earlier stays listed even if its provider is now off.
    const extra = linked
      .identities()
      .map((row) => row.provider)
      .filter(isOauthProviderId)
      .filter((provider) => !enabled.includes(provider));
    return [...enabled, ...extra];
  });
  // Mint the link ticket as soon as the methods show, so tapping "Connect"
  // opens the provider straight from the gesture (no network wait a popup
  // blocker would punish).
  createEffect(
    on(signedIn, (isSignedIn) => {
      if (isSignedIn) void port.prepareLink().catch(() => undefined);
    })
  );
  const unlink = async (): Promise<void> => {
    const provider = removing();
    if (provider === null) return;
    try {
      await port.unlinkProvider(provider);
    } catch (error) {
      throw new Error(authFlowErrorMessage(i18n(), asError(error)));
    }
    await refresh();
  };
  const view = createMemo(
    (): SignInMethodsView => ({
      status: linked.isLoading() ? 'loading' : 'ready',
      syncFailed: syncFailed(),
      identities: linked.identities(),
      providers: providers(),
    })
  );
  return {
    view,
    removing,
    connect: async (provider) => {
      try {
        await port.linkProvider(provider);
      } catch (error) {
        throw new Error(authFlowErrorMessage(i18n(), asError(error)));
      }
    },
    remove: setRemoving,
    cancelRemove: () => setRemoving(null),
    confirmRemove: async () => {
      try {
        await unlink();
      } catch (error) {
        log.warn('unlink failed', { error: asError(error).message });
        throw error;
      }
    },
  };
}
