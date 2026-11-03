/** "Sign out of all devices": every session the account holds ends. */

import { Handles } from '@libs/test-ids-shared-ts/handles';
import { Trans, useLingui } from '@lingui/solid/macro';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { LogOutIcon } from '@pkgs/ui-root-client-ts/icons';
import { MutationModal } from '@pkgs/ui-root-client-ts/mutation-modal';
import type { JSX } from 'solid-js';

const ICON_SIZE = 16;

export function SignOutEverywhereButton(props: {
  /** The confirmation is open. */
  readonly confirming: boolean;
  readonly onOpen: () => void;
  readonly onClose: () => void;
  /** Ends every session; rejects with the message the dialog shows. */
  readonly onConfirm: () => Promise<void>;
}): JSX.Element {
  const { t } = useLingui();
  return (
    <>
      <Button
        title={t`Sign out of all devices`}
        intent="danger"
        variant="ghost"
        startIcon={<LogOutIcon size={ICON_SIZE} />}
        onClick={() => props.onOpen()}
        dataSet={{ testid: Handles.accountSignOutEverywhere }}
      />
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
    </>
  );
}
