import { useClipboard } from '@pkgs/device-client-ts/solid';
import { useRouter } from '@pkgs/ui-root-client-ts/app-router';
import type { JSX } from 'solid-js';
import { createMemo } from 'solid-js';
import { useIsSignedIn } from './access-facts';
import { AccountDevicesScreenView } from './account-devices-screen-view';
import { useSignInModal } from './auth-modals-provider';
import { useAccountDevices } from './use-account-devices';
import { useMyAccountId } from './use-current-user';
import { useFirstSyncFailed } from './use-first-sync-failed';

/** `/more/account/devices`: wires `AccountDevicesScreenView` to sync. */
export function AccountDevicesScreen(): JSX.Element {
  const router = useRouter();
  const accountId = useMyAccountId();
  const signedIn = useIsSignedIn();
  const signIn = useSignInModal();
  const clipboard = useClipboard();
  const syncFailed = useFirstSyncFailed();
  const scopedAccountId = createMemo(() => (signedIn() ? accountId() : null));
  const devices = useAccountDevices(scopedAccountId);
  const status = () => {
    if (!signedIn() || accountId() === null) return 'signedOut';
    return devices.isLoading() ? 'loading' : 'ready';
  };
  return (
    <AccountDevicesScreenView
      status={status()}
      devices={devices.devices()}
      accountId={accountId() ?? ''}
      syncFailed={syncFailed()}
      onSignIn={() => signIn.open()}
      onOpenDevice={(deviceId) =>
        router.push(`/more/account/device/${deviceId}`)
      }
      copy={(text) => clipboard.writeText(text)}
    />
  );
}
