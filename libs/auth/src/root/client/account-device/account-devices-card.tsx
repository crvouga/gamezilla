import { Trans, useLingui } from '@lingui/solid/macro';
import { useClipboard } from '@pkgs/device/solid';
import {
  CopyToClipboardField,
  EmptyState,
  MenuSection,
  SmartphoneIcon,
} from '@pkgs/ui';
import type { JSX } from 'solid-js';
import { createMemo, For, Show } from 'solid-js';
import { useIsSignedIn } from '../../../public/use-current-user';
import { useAccountDeviceIds } from '../use-account-device-ids';
import { AccountDeviceMenuRow } from './account-device-menu-row';

export type AccountDevicesCardProps = {
  accountId: string | null;
  onOpenDevice: (deviceId: string) => void;
};

/** Devices list body for the account devices screen. */
export function AccountDevicesCard(
  props: AccountDevicesCardProps
): JSX.Element {
  const { t } = useLingui();
  const clipboard = useClipboard();
  const signedIn = useIsSignedIn();
  const scopedAccountId = createMemo(() =>
    signedIn() ? props.accountId : null
  );
  const deviceIds = useAccountDeviceIds(scopedAccountId);

  return (
    <Show
      when={signedIn() && props.accountId !== null}
      fallback={
        <EmptyState
          icon={SmartphoneIcon}
          title={<Trans>Sign in to see your devices</Trans>}
          body={
            <Trans>Every install signed into your account shows up here.</Trans>
          }
        />
      }
    >
      <Show
        when={deviceIds().length > 0}
        fallback={
          <EmptyState
            icon={SmartphoneIcon}
            title={<Trans>No devices yet</Trans>}
            body={<Trans>Devices appear here after they sign in.</Trans>}
          />
        }
      >
        <div class="box gap-5">
          <MenuSection
            title={<Trans>Devices</Trans>}
            footer={<Trans>Tap a device for details.</Trans>}
          >
            <For each={deviceIds()}>
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
            value={props.accountId ?? ''}
            copy={(text) => clipboard.writeText(text)}
          />
        </div>
      </Show>
    </Show>
  );
}
