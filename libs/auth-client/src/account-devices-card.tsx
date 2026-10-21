import { Handles } from '@libs/test-ids-shared/handles';
import { Plural, Trans, useLingui } from '@lingui/solid/macro';
import { useClipboard } from '@pkgs/device-client/solid';
import { CopyToClipboardField } from '@pkgs/ui-root-client/copy-to-clipboard-field';
import { EmptyState } from '@pkgs/ui-root-client/empty-state';
import { SmartphoneIcon } from '@pkgs/ui-root-client/icons';
import { LoadingState } from '@pkgs/ui-root-client/loading-state';
import { MenuSection } from '@pkgs/ui-root-client/menu-section';
import { StackVertical } from '@pkgs/ui-root-client/stack';
import { Text } from '@pkgs/ui-root-client/text';
import type { JSX } from 'solid-js';
import { createMemo, For, Match, Switch } from 'solid-js';
import { useIsSignedIn } from './access-facts';
import { AccountDeviceMenuRow } from './account-device-menu-row';
import { AccountSyncErrorNotice } from './account-sync-error-notice';
import { useSignInModal } from './auth-modals-provider';
import { useAccountDeviceIds } from './use-account-device-ids';

export type AccountDevicesCardProps = {
  accountId: string | null;
  onOpenDevice: (deviceId: string) => void;
};

/** Devices list body for the account devices screen. */
export function AccountDevicesCard(
  props: AccountDevicesCardProps
): JSX.Element {
  const signedIn = useIsSignedIn();
  const scopedAccountId = createMemo(() =>
    signedIn() ? props.accountId : null
  );
  const devices = useAccountDeviceIds(scopedAccountId);

  return (
    <Switch
      fallback={
        <AccountDevicesList
          accountId={props.accountId ?? ''}
          deviceIds={devices.ids()}
          onOpenDevice={props.onOpenDevice}
        />
      }
    >
      <Match when={!signedIn() || props.accountId === null}>
        <DevicesSignInPrompt />
      </Match>
      <Match when={devices.isLoading()}>
        <LoadingState caption={<Trans>Loading your devices…</Trans>} />
      </Match>
      <Match when={devices.ids().length === 0}>
        <EmptyState
          icon={SmartphoneIcon}
          title={<Trans>No devices yet</Trans>}
          body={<Trans>Devices appear here after they sign in.</Trans>}
        />
      </Match>
    </Switch>
  );
}

function DevicesSignInPrompt(): JSX.Element {
  const { t } = useLingui();
  const signIn = useSignInModal();
  return (
    <EmptyState
      icon={SmartphoneIcon}
      title={<Trans>Sign in to see your devices</Trans>}
      body={
        <Trans>Every install signed into your account shows up here.</Trans>
      }
      action={{ label: t`Sign in`, onClick: () => signIn.open() }}
      dataSet={{ testid: Handles.accountDevicesSignIn }}
    />
  );
}

function AccountDevicesList(props: {
  readonly accountId: string;
  readonly deviceIds: readonly string[];
  readonly onOpenDevice: (deviceId: string) => void;
}): JSX.Element {
  const { t } = useLingui();
  const clipboard = useClipboard();
  return (
    <StackVertical gap="xl">
      <AccountSyncErrorNotice>
        <Trans>
          Couldn't reach the server yet, so only this device is listed.
        </Trans>
      </AccountSyncErrorNotice>
      <MenuSection
        title={
          <Text variant="inherit" testId={Handles.accountDevicesCount}>
            <Plural
              value={props.deviceIds.length}
              one="# device"
              other="# devices"
            />
          </Text>
        }
        footer={<Trans>Tap a device for details.</Trans>}
      >
        <For each={props.deviceIds}>
          {(deviceId) => (
            <AccountDeviceMenuRow
              deviceId={deviceId}
              onOpenDevice={props.onOpenDevice}
            />
          )}
        </For>
      </MenuSection>
      <CopyToClipboardField
        label={<Trans>Account ID</Trans>}
        helperText={t`Tap to copy`}
        value={props.accountId}
        copy={(text) => clipboard.writeText(text)}
      />
    </StackVertical>
  );
}
