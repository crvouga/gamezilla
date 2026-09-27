import { Handles } from '@libs/test-ids';
import { Trans, useLingui } from '@lingui/solid/macro';
import {
  MenuRow,
  MenuSection,
  ScreenBase,
  SmartphoneIcon,
  useRouter,
} from '@pkgs/ui';
import { type JSX, Show } from 'solid-js';
import { useHasAuthSession } from '../../public/access-facts';
import { useSignInModal } from '../../public/auth-modals-provider';
import { AccountActionsRow } from './account-actions-row';
import { SignInMethodsSection } from './sign-in-methods/sign-in-methods-section';
import { SignOutEverywhereButton } from './sign-in-methods/sign-out-everywhere';

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
    <ScreenBase
      screenId="account"
      breadcrumbs={[
        { name: <Trans>Spaces</Trans>, href: '/' },
        { name: <Trans>Settings</Trans>, href: '/more' },
        { name: <Trans>Account</Trans> },
      ]}
      scroll
      content={({ bodyClass }) => (
        <div class={`box ${bodyClass} gap-5`}>
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
        </div>
      )}
    />
  );
}
