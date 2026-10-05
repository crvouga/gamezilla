/**
 * "Sign-in methods": which providers sign in to this account, with the
 * address each one shares, and the actions to connect another or remove one.
 * The account keeps at least one; a provider the server has not enabled is
 * not offered.
 */

import { Handles } from '@libs/test-ids-shared/handles';
import { Trans } from '@lingui/solid/macro';
import type { OauthProviderId } from '@pkgs/auth-root-shared/sign-in-method';
import { MenuSection } from '@pkgs/ui-root-client/menu-section';
import { createMemo, createSignal, For, type JSX, onMount } from 'solid-js';

import { useAuthClientPort } from './auth-client-provider';
import { useSignInCapabilities } from './sign-in-capabilities-context';
import { SignInMethodRow } from './sign-in-method-row';
import { UnlinkMethodModal } from './unlink-method-modal';
import { useLinkedIdentities } from './use-linked-identities';

export function SignInMethodsSection(): JSX.Element {
  const capabilities = useSignInCapabilities();
  const port = useAuthClientPort();
  const linked = useLinkedIdentities();
  const [removing, setRemoving] = createSignal<OauthProviderId | null>(null);
  const providers = createMemo<readonly OauthProviderId[]>(() => {
    const enabled = [
      ...(capabilities.google ? (['google'] as const) : []),
      ...(capabilities.apple ? (['apple'] as const) : []),
    ];
    // A method linked earlier stays listed even if its provider is now off.
    const extra = linked()
      .map((row) => row.provider)
      .filter((provider) => !enabled.includes(provider));
    return [...enabled, ...extra];
  });
  // Mint the link ticket now, so tapping "Connect" opens the provider
  // straight from the gesture (no network wait a popup blocker would punish).
  onMount(() => {
    void port.prepareLink().catch(() => undefined);
  });
  return (
    <div class="box" data-testid={Handles.accountSignInMethods}>
      <MenuSection title={<Trans>Sign-in methods</Trans>}>
        <For each={providers()}>
          {(provider) => (
            <SignInMethodRow
              provider={provider}
              identity={
                linked().find((row) => row.provider === provider) ?? null
              }
              removable={linked().length > 1}
              onRemove={setRemoving}
            />
          )}
        </For>
      </MenuSection>
      <UnlinkMethodModal
        provider={removing()}
        onClose={() => setRemoving(null)}
      />
    </div>
  );
}
