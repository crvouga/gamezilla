/** "Sign out of all devices": every session the account holds ends. */

import { Handles } from '@libs/test-ids-shared/handles';
import { Trans, useLingui } from '@lingui/solid/macro';
import { Button } from '@pkgs/ui-root-client/button';
import { LogOutIcon } from '@pkgs/ui-root-client/icons';
import { MutationModal } from '@pkgs/ui-root-client/mutation-modal';
import { createSignal, type JSX } from 'solid-js';

import { useAuthClientPort } from './auth-client-provider';
import { useSignOutIntent } from './sign-out-intent';

const ICON_SIZE = 16;

export function SignOutEverywhereButton(): JSX.Element {
  const { t } = useLingui();
  const port = useAuthClientPort();
  const intent = useSignOutIntent();
  const [open, setOpen] = createSignal(false);
  // This device asked: its own sign-out is no news to the person here.
  const signOutEverywhere = async (): Promise<void> => {
    intent.expect();
    try {
      await port.signOutEverywhere();
    } catch (error) {
      intent.cancel();
      throw error;
    }
  };
  return (
    <>
      <Button
        title={t`Sign out of all devices`}
        intent="danger"
        variant="ghost"
        startIcon={<LogOutIcon size={ICON_SIZE} />}
        onClick={() => setOpen(true)}
        dataSet={{ testid: Handles.accountSignOutEverywhere }}
      />
      <MutationModal
        visible={open()}
        onClose={() => setOpen(false)}
        title={<Trans>Sign out of all devices?</Trans>}
        message={
          <Trans>
            Every device signed in to this account, including this one, will be
            signed out.
          </Trans>
        }
        submitLabel={<Trans>Sign out everywhere</Trans>}
        variant="destructive"
        operation={signOutEverywhere}
        loadingLabel={<Trans>Signing out…</Trans>}
        successTitle={<Trans>Signed out everywhere</Trans>}
        errorTitle={<Trans>Couldn't sign out everywhere</Trans>}
        submitDataSet={{ testid: Handles.accountSignOutEverywhereConfirm }}
        dismissDataSet={{ testid: Handles.accountSignOutEverywhereDone }}
      />
    </>
  );
}
