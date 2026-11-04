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
import { LoadingState } from '@pkgs/ui-root-client-ts/loading-state';
import { MenuRow } from '@pkgs/ui-root-client-ts/menu-row';
import { MenuSection } from '@pkgs/ui-root-client-ts/menu-section';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { For, type JSX, Show } from 'solid-js';

import { AccountSyncErrorNotice } from './account-sync-error-notice';
import { providerName } from './auth-flow-messages';
import { RemoveMethodControl, SignInMethodRow } from './sign-in-method-row';
import { UnlinkMethodModal } from './unlink-method-modal';
import type { LinkedIdentity } from './use-linked-identities';

/** The account's sign-in methods as the section shows them. */
export type SignInMethodsView = {
  /** Whether the linked identities are still being read. */
  readonly status: 'loading' | 'ready';
  /** The first sync failed, so methods may be missing. */
  readonly syncFailed: boolean;
  /** Methods on the account, one per provider. */
  readonly identities: readonly LinkedIdentity[];
  /**
   * Providers to list, in display order: the enabled ones, then any linked
   * earlier whose provider is now off.
   */
  readonly providers: readonly OauthProviderId[];
};

export type SignInMethodsSectionProps = {
  readonly methods: SignInMethodsView;
  /** The method whose removal is being confirmed. */
  readonly removing: SignInMethodId | null;
  /** Connects a provider; rejects with the message its row shows. */
  readonly onConnect: (provider: OauthProviderId) => Promise<void>;
  readonly onRemove: (method: SignInMethodId) => void;
  readonly onCancelRemove: () => void;
  /** Removes `removing`; rejects with the message the dialog shows. */
  readonly onConfirmRemove: () => Promise<void>;
};

export function SignInMethodsSection(
  props: SignInMethodsSectionProps
): JSX.Element {
  const identities = () => props.methods.identities;
  const removable = () => identities().length > 1;
  return (
    <StackVertical gap="md" testId={Handles.accountSignInMethods}>
      <AccountSyncErrorNotice failed={props.methods.syncFailed}>
        <Trans>
          Couldn't reach the server yet, so your sign-in methods may be missing.
        </Trans>
      </AccountSyncErrorNotice>
      <Show
        when={props.methods.status === 'ready'}
        fallback={
          <LoadingState
            variant="compact"
            caption={<Trans>Loading sign-in methods…</Trans>}
          />
        }
      >
        <MenuSection
          title={<Trans>Sign-in methods</Trans>}
          description={<Trans>How you sign in</Trans>}
          footer={<RemoveMethodFooter removable={removable()} />}
        >
          {/* Only a Synthetic User's account ever holds an email method. */}
          <Show when={identities().find((row) => row.provider === 'email')}>
            {(identity) => (
              <EmailMethodRow
                identity={identity()}
                removable={removable()}
                onRemove={() => props.onRemove('email')}
              />
            )}
          </Show>
          <For each={props.methods.providers}>
            {(provider) => (
              <SignInMethodRow
                provider={provider}
                identity={
                  identities().find((row) => row.provider === provider) ?? null
                }
                removable={removable()}
                onRemove={props.onRemove}
                onConnect={props.onConnect}
              />
            )}
          </For>
        </MenuSection>
      </Show>
      <UnlinkMethodModal
        provider={props.removing}
        onClose={props.onCancelRemove}
        onConfirm={props.onConfirmRemove}
      />
    </StackVertical>
  );
}

/**
 * What Remove does, under the methods: it stops that method signing in, and
 * the account keeps at least one, which is why the only one cannot go.
 */
function RemoveMethodFooter(props: {
  readonly removable: boolean;
}): JSX.Element {
  return (
    <Show
      when={props.removable}
      fallback={
        <Trans>
          Your account needs at least one way to sign in. Connect another before
          removing this one.
        </Trans>
      }
    >
      <Trans>
        Removing a method stops it signing in to this account. You can connect
        it again later.
      </Trans>
    </Show>
  );
}

function EmailMethodRow(props: {
  readonly identity: LinkedIdentity;
  readonly removable: boolean;
  readonly onRemove: () => void;
}): JSX.Element {
  const { i18n } = useLingui();
  return (
    <MenuRow
      title={providerName(i18n(), 'email')}
      caption={props.identity.email ?? ''}
      hideChevron
      trailing={
        <RemoveMethodControl
          method="email"
          removable={props.removable}
          onRemove={props.onRemove}
        />
      }
      dataSet={{ testid: Handles.accountSignInMethod('email') }}
    />
  );
}
