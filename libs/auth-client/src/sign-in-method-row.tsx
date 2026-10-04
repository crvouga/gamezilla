/** One provider on the account: linked (with its address) or connectable. */

import { Handles } from '@libs/test-ids-shared/handles';
import { Trans, useLingui } from '@lingui/solid/macro';
import type { OauthProviderId } from '@pkgs/auth-shared/sign-in-method';
import { BrandIcon } from '@pkgs/ui-client/brand-icon';
import { Button } from '@pkgs/ui-client/button';
import { MenuRow } from '@pkgs/ui-client/menu-row';
import { useMutationButton } from '@pkgs/ui-client/use-mutation-button';
import { type JSX, Show } from 'solid-js';

import { useAuthClientPort } from './auth-client-provider';
import {
  authFlowErrorMessage,
  providerName,
} from './auth-flow-messages';
import type { LinkedIdentity } from './use-linked-identities';

const ICON_SIZE = 20;

function AddressCaption(props: {
  readonly identity: LinkedIdentity;
}): JSX.Element {
  return (
    <Show
      when={props.identity.isPrivateEmail}
      fallback={<>{props.identity.email ?? ''}</>}
    >
      <Show
        when={props.identity.emailForwarding}
        fallback={<Trans>Hidden email · forwarding is off</Trans>}
      >
        <Trans>Hidden email ({props.identity.email ?? ''})</Trans>
      </Show>
    </Show>
  );
}

function ConnectButton(props: {
  readonly provider: OauthProviderId;
}): JSX.Element {
  const { i18n, t } = useLingui();
  const port = useAuthClientPort();
  const connect = useMutationButton({
    operation: async () => {
      try {
        await port.linkProvider(props.provider);
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        throw new Error(authFlowErrorMessage(i18n(), err));
      }
    },
    labels: {
      idle: t`Connect`,
      loading: t`Connecting…`,
      success: t`Connected`,
      error: t`Couldn't connect`,
    },
  });
  return (
    <div class="box items-end gap-1">
      <Button
        {...connect.buttonProps}
        variant="outline"
        size="sm"
        dataSet={{ testid: Handles.accountLinkProvider(props.provider) }}
      />
      <Show when={connect.error()}>
        {(error) => (
          <p class="text textCaption text-destructive max-w-55 text-right">
            {error().message}
          </p>
        )}
      </Show>
    </div>
  );
}

export function SignInMethodRow(props: {
  readonly provider: OauthProviderId;
  readonly identity: LinkedIdentity | null;
  /** False for the account's only method: it cannot be removed. */
  readonly removable: boolean;
  readonly onRemove: (provider: OauthProviderId) => void;
}): JSX.Element {
  const { i18n, t } = useLingui();
  return (
    <MenuRow
      title={providerName(i18n(), props.provider)}
      caption={
        <Show when={props.identity} fallback={<Trans>Not connected</Trans>}>
          {(identity) => <AddressCaption identity={identity()} />}
        </Show>
      }
      leading={<BrandIcon name={props.provider} size={ICON_SIZE} />}
      hideChevron
      trailing={
        <Show
          when={props.identity !== null}
          fallback={<ConnectButton provider={props.provider} />}
        >
          <Button
            title={t`Remove`}
            variant="ghost"
            intent="danger"
            size="sm"
            disabled={!props.removable}
            onClick={() => props.onRemove(props.provider)}
            dataSet={{ testid: Handles.accountUnlinkProvider(props.provider) }}
          />
        </Show>
      }
      dataSet={{ testid: Handles.accountSignInMethod(props.provider) }}
    />
  );
}
