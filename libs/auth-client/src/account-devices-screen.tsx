import { Trans } from '@lingui/solid/macro';
import { useRouter } from '@pkgs/ui-root-client/app-router';
import { ScreenBase } from '@pkgs/ui-root-client/screen-base';
import type { JSX } from 'solid-js';
import { AccountDevicesCard } from './account-devices-card';
import { useMyAccountId } from './use-current-user';

export function AccountDevicesScreen(): JSX.Element {
  const router = useRouter();
  const accountId = useMyAccountId();
  const onOpenDevice = (deviceId: string) => {
    router.push(`/more/account/device/${deviceId}`);
  };

  return (
    <ScreenBase
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
      scroll
      content={({ bodyClass }) => (
        <div class={`box gap-5 ${bodyClass}`}>
          <AccountDevicesCard
            accountId={accountId()}
            onOpenDevice={onOpenDevice}
          />
        </div>
      )}
    />
  );
}
