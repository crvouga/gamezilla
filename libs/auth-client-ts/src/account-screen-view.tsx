import { Handles } from '@libs/test-ids-shared-ts/handles';
import { Trans, useLingui } from '@lingui/solid/macro';
import type {
  OauthProviderId,
  SignInMethodId,
} from '@pkgs/auth-root-shared-ts/sign-in-method';
import {
  DatabaseIcon,
  SmartphoneIcon,
  Trash2Icon,
} from '@pkgs/ui-root-client-ts/icons';
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
  /** Opens what deletion removes, where it is confirmed. */
  readonly onOpenDeletion: () => void;
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
 * The account's irreversible choices, set apart at the foot under their own
 * "Danger zone" label, each in the destructive ink: Sign out of all devices
 * (asks first, in place) and Delete account (opens what deletion removes,
 * where it is confirmed). Compact: one line each, so the rare choices take
 * less room than the everyday ones above; each one's consequences are
 * spelled out where it is confirmed. Both ask before they act, so both end
 * the same way: no chevron on either.
 */
function AccountDangerZone(props: {
  readonly onSignOutEverywhere: () => void;
  readonly onOpenDeletion: () => void;
}): JSX.Element {
  const { t } = useLingui();
  return (
    <MenuSection
      title={<Trans>Danger zone</Trans>}
      description={<Trans>You confirm before either one happens</Trans>}
    >
      <SignOutEverywhereRow onOpen={props.onSignOutEverywhere} />
      <MenuRow
        title={t`Delete account`}
        leading={<Trash2Icon size={ROW_ICON_SIZE} color="destructive" />}
        tone="destructive"
        onClick={() => props.onOpenDeletion()}
        hideChevron
        dataSet={{ testid: 'account-delete' }}
      />
    </MenuSection>
  );
}

/**
 * `/more/account`, presentational: sign-in methods, security (devices and
 * Sign out for this device), the data export entry, and a danger zone at
 * the foot (Sign out of all devices, Delete account); each sign-out spells
 * out its scope and asks first. A guest sees devices (which asks them to
 * sign in) and Sign in only. `AccountScreen` wires it to the session and
 * auth port.
 */
export function AccountScreenView(props: AccountScreenViewProps): JSX.Element {
  const { t } = useLingui();
  return (
    <MenuScreen
      screenId="account"
      breadcrumbs={[
        { name: <Trans>Profile</Trans>, href: '/profile' },
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
      <MenuSection
        title={<Trans>Security</Trans>}
        description={<Trans>Where you are signed in</Trans>}
      >
        <MenuRow
          title={t`Devices`}
          caption={t`Installs signed into this account`}
          leading={<SmartphoneIcon size={ROW_ICON_SIZE} color="icon" />}
          onClick={() => props.onOpenDevices()}
          dataSet={{ testid: Handles.accountDevices }}
        />
        <Show when={props.signedIn}>
          <SignOutRow onOpen={props.onSignOut} />
        </Show>
      </MenuSection>
      <Show when={props.signedIn}>
        <MenuSection
          title={<Trans>Your data</Trans>}
          description={
            <Trans>
              A copy of your profile, friends, progress and preferences
            </Trans>
          }
        >
          <MenuRow
            title={t`Export your data`}
            caption={t`Download a personal-data export`}
            leading={<DatabaseIcon size={ROW_ICON_SIZE} color="icon" />}
            onClick={() => props.onOpenPrivacy()}
            dataSet={{ testid: 'account-privacy' }}
          />
        </MenuSection>
        <AccountDangerZone
          onSignOutEverywhere={props.onSignOutEverywhere}
          onOpenDeletion={props.onOpenDeletion}
        />
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
