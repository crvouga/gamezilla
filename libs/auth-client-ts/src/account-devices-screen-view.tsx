import { Handles } from '@libs/test-ids-shared-ts/handles';
import { Plural, Trans, useLingui } from '@lingui/solid/macro';
import type { ClipboardCopy } from '@pkgs/ui-root-client-ts/copy-to-clipboard-field';
import { CopyToClipboardField } from '@pkgs/ui-root-client-ts/copy-to-clipboard-field';
import { EmptyState } from '@pkgs/ui-root-client-ts/empty-state';
import { SmartphoneIcon } from '@pkgs/ui-root-client-ts/icons';
import { LoadingState } from '@pkgs/ui-root-client-ts/loading-state';
import { MenuScreen } from '@pkgs/ui-root-client-ts/menu-screen';
import { MenuSection } from '@pkgs/ui-root-client-ts/menu-section';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { Text } from '@pkgs/ui-root-client-ts/text';
import type { JSX } from 'solid-js';
import { For, Match, Switch } from 'solid-js';
import { AccountDeviceMenuRow } from './account-device-menu-row';
import type { AccountDeviceView } from './account-device-view';
import { AccountSyncErrorNotice } from './account-sync-error-notice';

/** Signed out (no devices to list), still reading, or known. */
export type AccountDevicesStatus = 'signedOut' | 'loading' | 'ready';

export type AccountDevicesScreenViewProps = {
  readonly status: AccountDevicesStatus;
  /** The account's devices, current device first. */
  readonly devices: readonly AccountDeviceView[];
  readonly accountId: string;
  /** The first sync failed, so only this device may be listed. */
  readonly syncFailed: boolean;
  readonly onSignIn: () => void;
  readonly onOpenDevice: (deviceId: string) => void;
  /** Writes the account id to the clipboard. */
  readonly copy: ClipboardCopy;
};

function DevicesSignInPrompt(props: { onSignIn: () => void }): JSX.Element {
  const { t } = useLingui();
  return (
    <EmptyState
      icon={SmartphoneIcon}
      title={<Trans>Sign in to see your devices</Trans>}
      body={
        <Trans>Every install signed into your account shows up here.</Trans>
      }
      action={{ label: t`Sign in`, onClick: () => props.onSignIn() }}
      dataSet={{ testid: Handles.accountDevicesSignIn }}
    />
  );
}

function AccountDevicesList(props: AccountDevicesScreenViewProps): JSX.Element {
  const { t } = useLingui();
  return (
    <StackVertical gap="xl">
      <AccountSyncErrorNotice failed={props.syncFailed}>
        <Trans>
          Couldn't reach the server yet, so only this device is listed.
        </Trans>
      </AccountSyncErrorNotice>
      <MenuSection
        title={
          <Text variant="inherit" testId={Handles.accountDevicesCount}>
            <Plural
              value={props.devices.length}
              one="# device"
              other="# devices"
            />
          </Text>
        }
        footer={<Trans>Tap a device for details.</Trans>}
      >
        <For each={props.devices}>
          {(device) => (
            <AccountDeviceMenuRow
              device={device}
              onOpenDevice={props.onOpenDevice}
            />
          )}
        </For>
      </MenuSection>
      <CopyToClipboardField
        label={<Trans>Account ID</Trans>}
        helperText={t`Tap to copy`}
        value={props.accountId}
        copy={(text) => props.copy(text)}
      />
    </StackVertical>
  );
}

/**
 * `/more/account/devices`, presentational: every install signed into the
 * account, or why none are listed (signed out, loading, none yet).
 * `AccountDevicesScreen` reads the devices from sync.
 */
export function AccountDevicesScreenView(
  props: AccountDevicesScreenViewProps
): JSX.Element {
  return (
    <MenuScreen
      screenId="account-devices"
      breadcrumbs={[
        { name: <Trans>Spaces</Trans>, href: '/' },
        { name: <Trans>Settings</Trans>, href: '/more' },
        {
          name: <Trans>Account</Trans>,
          href: '/more/account',
        },
        { name: <Trans>Devices</Trans> },
      ]}
    >
      <Switch fallback={<AccountDevicesList {...props} />}>
        <Match when={props.status === 'signedOut'}>
          <DevicesSignInPrompt onSignIn={props.onSignIn} />
        </Match>
        <Match when={props.status === 'loading'}>
          <LoadingState caption={<Trans>Loading your devices…</Trans>} />
        </Match>
        <Match when={props.devices.length === 0}>
          <EmptyState
            icon={SmartphoneIcon}
            title={<Trans>No devices yet</Trans>}
            body={<Trans>Devices appear here after they sign in.</Trans>}
          />
        </Match>
      </Switch>
    </MenuScreen>
  );
}
