/**
 * "Sign-in methods": which providers sign in to this account, with the
 * address each one shares, and the actions to connect another or remove one.
 * The account keeps at least one; a provider the server has not enabled is
 * not offered.
 */

import { Handles } from '@libs/test-ids-shared-ts/handles';
import { Trans, useLingui } from '@lingui/solid/macro';
import type {
  OauthProviderId,
  SignInMethodId,
} from '@pkgs/auth-root-shared-ts/sign-in-method';
import { isOauthProviderId } from '@pkgs/auth-root-shared-ts/sign-in-method';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { LoadingState } from '@pkgs/ui-root-client-ts/loading-state';
import { MenuRow } from '@pkgs/ui-root-client-ts/menu-row';
import { MenuSection } from '@pkgs/ui-root-client-ts/menu-section';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import {
  createMemo,
  createSignal,
  For,
  type JSX,
  onMount,
  Show,
} from 'solid-js';

import { AccountSyncErrorNotice } from './account-sync-error-notice';
import { useAuthClientPort } from './auth-client-provider';
import { providerName } from './auth-flow-messages';
import { useSignInCapabilities } from './sign-in-capabilities-context';
import { SignInMethodRow } from './sign-in-method-row';
import { UnlinkMethodModal } from './unlink-method-modal';
import type { LinkedIdentity } from './use-linked-identities';
import { useLinkedIdentities } from './use-linked-identities';

export function SignInMethodsSection(): JSX.Element {
  const capabilities = useSignInCapabilities();
  const port = useAuthClientPort();
  const linked = useLinkedIdentities();
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
  // Mint the link ticket now, so tapping "Connect" opens the provider
  // straight from the gesture (no network wait a popup blocker would punish).
  onMount(() => {
    void port.prepareLink().catch(() => undefined);
  });
  return (
    <StackVertical gap="md" testId={Handles.accountSignInMethods}>
      <AccountSyncErrorNotice>
        <Trans>
          Couldn't reach the server yet, so your sign-in methods may be missing.
        </Trans>
      </AccountSyncErrorNotice>
      <Show
        when={!linked.isLoading()}
        fallback={
          <LoadingState
            variant="compact"
            caption={<Trans>Loading sign-in methods…</Trans>}
          />
        }
      >
        <MenuSection title={<Trans>Sign-in methods</Trans>}>
          {/* Only a Synthetic User's account ever holds an email method. */}
          <Show
            when={linked.identities().find((row) => row.provider === 'email')}
          >
            {(identity) => (
              <EmailMethodRow
                identity={identity()}
                removable={linked.identities().length > 1}
                onRemove={() => setRemoving('email')}
              />
            )}
          </Show>
          <For each={providers()}>
            {(provider) => (
              <SignInMethodRow
                provider={provider}
                identity={
                  linked
                    .identities()
                    .find((row) => row.provider === provider) ?? null
                }
                removable={linked.identities().length > 1}
                onRemove={setRemoving}
              />
            )}
          </For>
        </MenuSection>
      </Show>
      <UnlinkMethodModal
        provider={removing()}
        onClose={() => setRemoving(null)}
      />
    </StackVertical>
  );
}

function EmailMethodRow(props: {
  readonly identity: LinkedIdentity;
  readonly removable: boolean;
  readonly onRemove: () => void;
}): JSX.Element {
  const { i18n, t } = useLingui();
  return (
    <MenuRow
      title={providerName(i18n(), 'email')}
      caption={props.identity.email ?? ''}
      hideChevron
      trailing={
        <Button
          title={t`Remove`}
          variant="ghost"
          intent="danger"
          size="sm"
          disabled={!props.removable}
          onClick={props.onRemove}
          dataSet={{ testid: Handles.accountUnlinkProvider('email') }}
        />
      }
      dataSet={{ testid: Handles.accountSignInMethod('email') }}
    />
  );
}
