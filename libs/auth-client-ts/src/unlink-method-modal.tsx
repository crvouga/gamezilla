/** Confirm-first removal of one sign-in method (never the last one). */

import { Handles } from '@libs/test-ids-shared-ts/handles';
import { Trans, useLingui } from '@lingui/solid/macro';
import type { SignInMethodId } from '@pkgs/auth-root-shared-ts/sign-in-method';
import { MutationModal } from '@pkgs/ui-root-client-ts/mutation-modal';
import type { JSX } from 'solid-js';

import { providerName } from './auth-flow-messages';

export function UnlinkMethodModal(props: {
  /** The method being removed; the dialog is open while it is set. */
  readonly provider: SignInMethodId | null;
  readonly onClose: () => void;
  /** Removes the method; rejects with the message the dialog shows. */
  readonly onConfirm: () => Promise<void>;
}): JSX.Element {
  const { i18n } = useLingui();
  const name = () =>
    props.provider === null ? '' : providerName(i18n(), props.provider);
  return (
    <MutationModal
      visible={props.provider !== null}
      onClose={() => props.onClose()}
      title={<Trans>Remove {name()} sign-in?</Trans>}
      message={
        <Trans>
          You won't be able to sign in with {name()} anymore. You can connect it
          again later.
        </Trans>
      }
      submitLabel={<Trans>Remove</Trans>}
      variant="destructive"
      operation={() => props.onConfirm()}
      loadingLabel={<Trans>Removing…</Trans>}
      successTitle={<Trans>Removed</Trans>}
      successBody={<Trans>{name()} no longer signs in to this account.</Trans>}
      errorTitle={<Trans>Couldn't remove it</Trans>}
      submitDataSet={{ testid: Handles.accountUnlinkConfirm }}
      dismissDataSet={{ testid: Handles.accountUnlinkDone }}
    />
  );
}
