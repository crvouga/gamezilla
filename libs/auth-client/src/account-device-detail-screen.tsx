import { Trans } from '@lingui/solid/macro';
import { useLocalSearchParams } from '@pkgs/ui-root-client/app-router';
import { EmptyState } from '@pkgs/ui-root-client/empty-state';
import { SmartphoneIcon } from '@pkgs/ui-root-client/icons';
import { MenuScreen } from '@pkgs/ui-root-client/menu-screen';
import type { JSX } from 'solid-js';
import { createMemo, Show } from 'solid-js';
import { AccountDeviceDetailBody } from './account-device-detail-body';
import { AccountDeviceDetailHeader } from './account-device-detail-header';

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
        fallback={
          <EmptyState
            icon={SmartphoneIcon}
            title={<Trans>Device not found</Trans>}
            body={<Trans>This link is missing a device id.</Trans>}
          />
        }
      >
        {(id) => (
          <>
            <AccountDeviceDetailHeader deviceId={id()} />
            <AccountDeviceDetailBody deviceId={id()} />
          </>
        )}
      </Show>
    </MenuScreen>
  );
}
