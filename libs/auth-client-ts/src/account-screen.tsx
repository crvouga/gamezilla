import { useRouter } from '@pkgs/ui-root-client-ts/app-router';
import type { JSX } from 'solid-js';
import { useHasAuthSession } from './access-facts';
import { AccountScreenView } from './account-screen-view';
import { useSignInModal, useSignOutModal } from './auth-modals-provider';
import { useSignInMethods } from './use-sign-in-methods';
import { useSignOutEverywhere } from './use-sign-out-everywhere';

export type AccountScreenProps = {
  /** Profile identity block (avatar + username + email). */
  readonly identity?: JSX.Element | undefined;
};

/** `/more/account`: wires `AccountScreenView` to the session and auth port. */
export function AccountScreen(props: AccountScreenProps): JSX.Element {
  const router = useRouter();
  const signedIn = useHasAuthSession();
  const signIn = useSignInModal();
  const signOut = useSignOutModal();
  const methods = useSignInMethods(signedIn);
  const everywhere = useSignOutEverywhere();
  // A guest has no devices to list: ask them to sign in, right there.
  const openDevices = () => {
    if (!signedIn()) {
      signIn.open();
      return;
    }
    router.push('/more/account/devices');
  };
  return (
    <AccountScreenView
      signedIn={signedIn()}
      identity={props.identity}
      methods={methods.view()}
      removingMethod={methods.removing()}
      signingOutEverywhere={everywhere.confirming()}
      onOpenDevices={openDevices}
      onOpenPrivacy={() => router.push('/profile/privacy')}
      onOpenDeletion={() => router.push('/profile/privacy')}
      onSignIn={() => signIn.open()}
      onSignOut={() => signOut.open()}
      onConnectMethod={methods.connect}
      onRemoveMethod={methods.remove}
      onCancelRemoveMethod={methods.cancelRemove}
      onConfirmRemoveMethod={methods.confirmRemove}
      onSignOutEverywhere={everywhere.open}
      onCancelSignOutEverywhere={everywhere.close}
      onConfirmSignOutEverywhere={everywhere.confirm}
    />
  );
}
