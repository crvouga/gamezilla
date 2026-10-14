import { Handles } from '@libs/test-ids-shared/handles';
import { Trans, useLingui } from '@lingui/solid/macro';
import { useRouter } from '@pkgs/ui-root-client/app-router';
import { SmartphoneIcon } from '@pkgs/ui-root-client/icons';
import { MenuRow } from '@pkgs/ui-root-client/menu-row';
import { MenuScreen } from '@pkgs/ui-root-client/menu-screen';
import { MenuSection } from '@pkgs/ui-root-client/menu-section';
import { type JSX, Show } from 'solid-js';
import { useHasAuthSession } from './access-facts';
import { AccountActionsRow } from './account-actions-row';
import { useSignInModal } from './auth-modals-provider';
import { SignInMethodsSection } from './sign-in-methods-section';
import { SignOutEverywhereButton } from './sign-out-everywhere';

const ROW_ICON_SIZE = 20;

export type AccountScreenProps = {
  /** Profile identity block (avatar + username + email). */
  readonly identity?: JSX.Element | undefined;
};

export function AccountScreen(props: AccountScreenProps): JSX.Element {
  const { t } = useLingui();
  const router = useRouter();
  const signedIn = useHasAuthSession();
  const signIn = useSignInModal();
  // A guest has no devices to list: ask them to sign in, right there.
  const openDevices = () => {
    if (!signedIn()) {
      signIn.open();
      return;
    }
    router.push('/more/account/devices');
  };

  return (
    <MenuScreen
      screenId="account"
      breadcrumbs={[
        { name: <Trans>Spaces</Trans>, href: '/' },
        { name: <Trans>Settings</Trans>, href: '/more' },
        { name: <Trans>Account</Trans> },
      ]}
    >
      {props.identity}
      <Show when={signedIn()}>
        <SignInMethodsSection />
      </Show>
      <MenuSection title={<Trans>Security</Trans>}>
        <MenuRow
          title={t`Devices`}
          caption={t`Installs signed into this account`}
          leading={<SmartphoneIcon size={ROW_ICON_SIZE} color="icon" />}
          onClick={openDevices}
          dataSet={{ testid: Handles.accountDevices }}
        />
      </MenuSection>
      <AccountActionsRow />
      <Show when={signedIn()}>
        <SignOutEverywhereButton />
      </Show>
    </MenuScreen>
  );
}
