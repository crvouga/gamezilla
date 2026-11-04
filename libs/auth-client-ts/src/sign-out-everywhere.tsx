/** "Sign out of all devices": every session the account holds ends. */

import { Handles } from '@libs/test-ids-shared-ts/handles';
import { Trans, useLingui } from '@lingui/solid/macro';
import { LogOutIcon } from '@pkgs/ui-root-client-ts/icons';
import { MenuRow } from '@pkgs/ui-root-client-ts/menu-row';
import { MutationModal } from '@pkgs/ui-root-client-ts/mutation-modal';
import type { JSX } from 'solid-js';

const ROW_ICON_SIZE = 20;

/**
 * A destructive row in the account's danger zone at the foot of the screen,
 * apart from Sign out (this device only): its title is in the destructive
 * ink, its caption says what it ends, and {@link SignOutEverywhereConfirm}
 * asks before anything happens.
 */
export function SignOutEverywhereRow(props: {
  readonly onOpen: () => void;
}): JSX.Element {
  const { t } = useLingui();
  return (
    <MenuRow
      title={t`Sign out of all devices`}
      caption={t`Ends every session on this account, this device included`}
      leading={<LogOutIcon size={ROW_ICON_SIZE} color="destructive" />}
      tone="destructive"
      onClick={() => props.onOpen()}
      // It asks first, in place: no chevron, since it opens no screen.
      hideChevron
      dataSet={{ testid: Handles.accountSignOutEverywhere }}
    />
  );
}

/** The confirmation {@link SignOutEverywhereRow} opens. */
export function SignOutEverywhereConfirm(props: {
  /** The confirmation is open. */
  readonly confirming: boolean;
  readonly onClose: () => void;
  /** Ends every session; rejects with the message the dialog shows. */
  readonly onConfirm: () => Promise<void>;
}): JSX.Element {
  return (
    <MutationModal
      visible={props.confirming}
      onClose={() => props.onClose()}
      title={<Trans>Sign out of all devices?</Trans>}
      message={
        <Trans>
          Every device signed in to this account, including this one, will be
          signed out.
        </Trans>
      }
      submitLabel={<Trans>Sign out everywhere</Trans>}
      variant="destructive"
      operation={() => props.onConfirm()}
      loadingLabel={<Trans>Signing out…</Trans>}
      successTitle={<Trans>Signed out everywhere</Trans>}
      errorTitle={<Trans>Couldn't sign out everywhere</Trans>}
      submitDataSet={{ testid: Handles.accountSignOutEverywhereConfirm }}
      dismissDataSet={{ testid: Handles.accountSignOutEverywhereDone }}
    />
  );
}
