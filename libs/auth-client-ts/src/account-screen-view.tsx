import { Handles } from '@libs/test-ids-shared-ts/handles';
import { Trans, useLingui } from '@lingui/solid/macro';
import type {
  OauthProviderId,
  SignInMethodId,
} from '@pkgs/auth-root-shared-ts/sign-in-method';
import { DatabaseIcon, SmartphoneIcon } from '@pkgs/ui-root-client-ts/icons';
import { MenuRow } from '@pkgs/ui-root-client-ts/menu-row';
import { MenuScreen } from '@pkgs/ui-root-client-ts/menu-screen';
import { MenuSection } from '@pkgs/ui-root-client-ts/menu-section';
import { type JSX, Show } from 'solid-js';
import { AccountSignInAction, SignOutRow } from './account-actions-row';
import type { SignInMethodsView } from './sign-in-methods-section';
import { SignInMethodsSection } from './sign-in-methods-section';
import {
  SignOutEverywhereConfirm,
  SignOutEverywhereRow,
} from './sign-out-everywhere';

const ROW_ICON_SIZE = 20;

export type AccountScreenViewProps = {
  /** A provider session is on this device; a guest sees only sign-in. */
  readonly signedIn: boolean;
  /** Profile identity block (avatar + username + email). */
  readonly identity?: JSX.Element | undefined;
  /** Sign-in methods, shown while signed in. */
  readonly methods: SignInMethodsView;
  /** The sign-in method whose removal is being confirmed. */
  readonly removingMethod: SignInMethodId | null;
  /** The sign-out-everywhere confirmation is open. */
  readonly signingOutEverywhere: boolean;
  readonly onOpenDevices: () => void;
  readonly onOpenPrivacy: () => void;
  readonly onSignIn: () => void;
  readonly onSignOut: () => void;
  /** Connects a provider; rejects with the message its row shows. */
  readonly onConnectMethod: (provider: OauthProviderId) => Promise<void>;
  readonly onRemoveMethod: (method: SignInMethodId) => void;
  readonly onCancelRemoveMethod: () => void;
  /** Removes `removingMethod`; rejects with the message the dialog shows. */
  readonly onConfirmRemoveMethod: () => Promise<void>;
  readonly onSignOutEverywhere: () => void;
  readonly onCancelSignOutEverywhere: () => void;
  /** Ends every session; rejects with the message the dialog shows. */
  readonly onConfirmSignOutEverywhere: () => Promise<void>;
};

/**
 * `/more/account`, presentational: sign-in methods, security (devices, Sign
 * out for this device and Sign out of all devices, each with its scope
 * spelled out, as calm rows whose confirmations carry the destructive tone)
 * and the privacy entry. A guest sees devices (which asks them to sign in)
 * and Sign in only. `AccountScreen` wires it to the session and auth port.
 */
export function AccountScreenView(props: AccountScreenViewProps): JSX.Element {
  const { t } = useLingui();
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
      <Show when={props.signedIn}>
        <SignInMethodsSection
          methods={props.methods}
          removing={props.removingMethod}
          onConnect={props.onConnectMethod}
          onRemove={props.onRemoveMethod}
          onCancelRemove={props.onCancelRemoveMethod}
          onConfirmRemove={props.onConfirmRemoveMethod}
        />
      </Show>
      <MenuSection title={<Trans>Security</Trans>}>
        <MenuRow
          title={t`Devices`}
          caption={t`Installs signed into this account`}
          leading={<SmartphoneIcon size={ROW_ICON_SIZE} color="icon" />}
          onClick={() => props.onOpenDevices()}
          dataSet={{ testid: Handles.accountDevices }}
        />
        <Show when={props.signedIn}>
          <SignOutRow onOpen={props.onSignOut} />
          <SignOutEverywhereRow onOpen={props.onSignOutEverywhere} />
        </Show>
      </MenuSection>
      <Show when={props.signedIn}>
        <MenuSection title={<Trans>Your data</Trans>}>
          <MenuRow
            title={t`Account privacy`}
            caption={t`Take a personal-data export or delete your account`}
            leading={<DatabaseIcon size={ROW_ICON_SIZE} color="icon" />}
            onClick={() => props.onOpenPrivacy()}
            dataSet={{ testid: 'account-privacy' }}
          />
        </MenuSection>
      </Show>
      <Show when={!props.signedIn}>
        <AccountSignInAction onSignIn={props.onSignIn} />
      </Show>
      <Show when={props.signedIn}>
        <SignOutEverywhereConfirm
          confirming={props.signingOutEverywhere}
          onClose={props.onCancelSignOutEverywhere}
          onConfirm={props.onConfirmSignOutEverywhere}
        />
      </Show>
    </MenuScreen>
  );
}
