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
              onClick={() => {
                router.push('/more/account/devices');
              }}
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
