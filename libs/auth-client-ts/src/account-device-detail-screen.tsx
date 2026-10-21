import { Trans } from '@lingui/solid/macro';
import { useLocalSearchParams } from '@pkgs/ui-root-client-ts/app-router';
import { EmptyState } from '@pkgs/ui-root-client-ts/empty-state';
import { SmartphoneIcon } from '@pkgs/ui-root-client-ts/icons';
import { LoadingState } from '@pkgs/ui-root-client-ts/loading-state';
import { MenuScreen } from '@pkgs/ui-root-client-ts/menu-screen';
import type { JSX } from 'solid-js';
import { createMemo, Match, Show, Switch } from 'solid-js';
import { AccountDeviceDetailBody } from './account-device-detail-body';
import { AccountDeviceDetailHeader } from './account-device-detail-header';
import { useDeviceRowState } from './use-device-column';

function normalizeDeviceId(raw: string | undefined): string | null {
  if (raw === undefined) return null;
  if (raw.trim().length === 0) return null;
  return raw.trim();
}

export function AccountDeviceDetailScreen(): JSX.Element {
  const params = useLocalSearchParams<{ deviceId?: string | undefined }>();
  const deviceId = createMemo(() => normalizeDeviceId(params().deviceId));

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
      <Show
        when={deviceId()}
        keyed
        fallback={
          <EmptyState
            icon={SmartphoneIcon}
            title={<Trans>Device not found</Trans>}
            body={<Trans>This link is missing a device id.</Trans>}
          />
        }
      >
        {(id) => <AccountDeviceDetail deviceId={id} />}
      </Show>
    </MenuScreen>
  );
}

function AccountDeviceDetail(props: {
  readonly deviceId: string;
}): JSX.Element {
  const row = useDeviceRowState(() => props.deviceId);
  return (
    <Switch
      fallback={
        <>
          <AccountDeviceDetailHeader deviceId={props.deviceId} />
          <AccountDeviceDetailBody deviceId={props.deviceId} />
        </>
      }
    >
      <Match when={row.isLoading()}>
        <LoadingState caption={<Trans>Loading device…</Trans>} />
      </Match>
      <Match when={!row.found()}>
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
  );
}
