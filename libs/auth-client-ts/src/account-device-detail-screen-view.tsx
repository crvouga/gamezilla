import { Trans } from '@lingui/solid/macro';
import type { ClipboardCopy } from '@pkgs/ui-root-client-ts/copy-to-clipboard-field';
import { EmptyState } from '@pkgs/ui-root-client-ts/empty-state';
import { SmartphoneIcon } from '@pkgs/ui-root-client-ts/icons';
import { LoadingState } from '@pkgs/ui-root-client-ts/loading-state';
import { MenuScreen } from '@pkgs/ui-root-client-ts/menu-screen';
import type { JSX } from 'solid-js';
import { Match, Switch } from 'solid-js';
import { AccountDeviceDetailBody } from './account-device-detail-body';
import { AccountDeviceDetailHeader } from './account-device-detail-header';
import type { AccountDeviceView } from './account-device-view';

export type AccountDeviceDetailScreenViewProps = {
  /**
   * `missingId`: the link names no device. `notFound`: this copy has no row
   * for it. Otherwise the device is still reading or shown.
   */
  readonly status: 'missingId' | 'loading' | 'notFound' | 'ready';
  /** The device, when `status` is `ready`. */
  readonly device: AccountDeviceView | null;
  /** Writes the device id to the clipboard. */
  readonly copy: ClipboardCopy;
};

/**
 * `/more/account/device/:deviceId`, presentational: one device's details,
 * sessions and id, or why it cannot be shown. `AccountDeviceDetailScreen`
 * reads the device from sync.
 */
export function AccountDeviceDetailScreenView(
  props: AccountDeviceDetailScreenViewProps
): JSX.Element {
  return (
    <MenuScreen
      screenId="account-device-detail"
      breadcrumbs={[
        { name: <Trans>Spaces</Trans>, href: '/' },
        { name: <Trans>Settings</Trans>, href: '/more' },
        {
          name: <Trans>Account</Trans>,
          href: '/more/account',
        },
        { name: <Trans>Device</Trans> },
      ]}
    >
      <Switch>
        <Match when={props.status === 'missingId'}>
          <EmptyState
            icon={SmartphoneIcon}
            title={<Trans>Device not found</Trans>}
            body={<Trans>This link is missing a device id.</Trans>}
          />
        </Match>
        <Match when={props.status === 'loading'}>
          <LoadingState caption={<Trans>Loading device…</Trans>} />
        </Match>
        <Match when={props.status === 'ready' ? props.device : null}>
          {(device) => (
            <>
              <AccountDeviceDetailHeader device={device()} />
              <AccountDeviceDetailBody device={device()} copy={props.copy} />
            </>
          )}
        </Match>
        <Match when={true}>
          <EmptyState
            icon={SmartphoneIcon}
            title={<Trans>Device not found</Trans>}
            body={
              <Trans>
                It may have signed out, or it hasn't synced to this device yet.
              </Trans>
            }
          />
        </Match>
      </Switch>
    </MenuScreen>
  );
}
