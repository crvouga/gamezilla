/** One provider on the account: linked (with its address) or connectable. */

import { Handles } from '@libs/test-ids-shared-ts/handles';
import { Trans, useLingui } from '@lingui/solid/macro';
import type { OauthProviderId } from '@pkgs/auth-root-shared-ts/sign-in-method';
import { BrandIcon } from '@pkgs/ui-root-client-ts/brand-icon';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { MenuRow } from '@pkgs/ui-root-client-ts/menu-row';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { P } from '@pkgs/ui-root-client-ts/text';
import { useMutationButton } from '@pkgs/ui-root-client-ts/use-mutation-button';
import { type JSX, Show } from 'solid-js';

import { useAuthClientPort } from './auth-client-provider';
import { authFlowErrorMessage, providerName } from './auth-flow-messages';
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

/**
 * A provider not yet on the account: "Not connected" and a Connect button.
 * A failed connect says why under the caption, so the row keeps its shape.
 */
function ConnectableMethodRow(props: {
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
    <MenuRow
      title={providerName(i18n(), props.provider)}
      caption={
        <StackVertical gap="xs">
          <P variant="inherit">
            <Trans>Not connected</Trans>
          </P>
          <Show when={connect.error()}>
            {(error) => (
              <P variant="inherit" tone="destructive" role="alert">
                {error().message}
              </P>
            )}
          </Show>
        </StackVertical>
      }
      leading={<BrandIcon name={props.provider} size={ICON_SIZE} />}
      hideChevron
      trailing={
        <Button
          {...connect.buttonProps}
          variant="outline"
          size="sm"
          dataSet={{ testid: Handles.accountLinkProvider(props.provider) }}
        />
      }
      dataSet={{ testid: Handles.accountSignInMethod(props.provider) }}
    />
  );
}

function LinkedMethodRow(props: {
  readonly provider: OauthProviderId;
  readonly identity: LinkedIdentity;
  readonly removable: boolean;
  readonly onRemove: (provider: OauthProviderId) => void;
}): JSX.Element {
  const { i18n, t } = useLingui();
  return (
    <MenuRow
      title={providerName(i18n(), props.provider)}
      caption={<AddressCaption identity={props.identity} />}
      leading={<BrandIcon name={props.provider} size={ICON_SIZE} />}
      hideChevron
      trailing={
        <Button
          title={t`Remove`}
          variant="ghost"
          intent="danger"
          size="sm"
          disabled={!props.removable}
          onClick={() => props.onRemove(props.provider)}
          dataSet={{ testid: Handles.accountUnlinkProvider(props.provider) }}
        />
      }
      dataSet={{ testid: Handles.accountSignInMethod(props.provider) }}
    />
  );
}

export function SignInMethodRow(props: {
  readonly provider: OauthProviderId;
  readonly identity: LinkedIdentity | null;
  /** False for the account's only method: it cannot be removed. */
  readonly removable: boolean;
  readonly onRemove: (provider: OauthProviderId) => void;
}): JSX.Element {
  return (
    <Show
      when={props.identity}
      fallback={<ConnectableMethodRow provider={props.provider} />}
    >
      {(identity) => (
        <LinkedMethodRow
          provider={props.provider}
          identity={identity()}
          removable={props.removable}
          onRemove={props.onRemove}
        />
      )}
    </Show>
  );
}
