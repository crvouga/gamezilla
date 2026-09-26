/** Confirm-first removal of one sign-in method (never the last one). */

import { Handles } from '@libs/test-ids';
import { Trans, useLingui } from '@lingui/solid/macro';
import type { OauthProviderId } from '@pkgs/auth/shared';
import { useLogger } from '@pkgs/logger/solid';
import { MutationModal } from '@pkgs/ui';
import type { JSX } from 'solid-js';

import { useAuthClientPort } from '../../../public/auth-client-provider';
import {
  authFlowErrorMessage,
  providerName,
} from '../../../public/auth-flow-messages';
import { useIdentityRefresh } from './use-identity-refresh';

export function UnlinkMethodModal(props: {
  readonly provider: OauthProviderId | null;
  readonly onClose: () => void;
}): JSX.Element {
  const { i18n } = useLingui();
  const port = useAuthClientPort();
  const refresh = useIdentityRefresh();
  const log = useLogger('auth-unlink');
  const name = () =>
    props.provider === null ? '' : providerName(i18n(), props.provider);
  const operation = async (): Promise<void> => {
    const provider = props.provider;
    if (provider === null) return;
    try {
      await port.unlinkProvider(provider);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      throw new Error(authFlowErrorMessage(i18n(), err));
    }
    await refresh();
  };
  return (
    <MutationModal
      visible={props.provider !== null}
      onClose={props.onClose}
      title={<Trans>Remove {name()} sign-in?</Trans>}
      message={
        <Trans>
          You won't be able to sign in with {name()} anymore. You can connect it
          again later.
        </Trans>
      }
      submitLabel={<Trans>Remove</Trans>}
      variant="destructive"
      operation={operation}
      loadingLabel={<Trans>Removing…</Trans>}
      successTitle={<Trans>Removed</Trans>}
      successBody={<Trans>{name()} no longer signs in to this account.</Trans>}
      errorTitle={<Trans>Couldn't remove it</Trans>}
      onError={(error) => log.warn('unlink failed', { error: error.message })}
      submitDataSet={{ testid: Handles.accountUnlinkConfirm }}
      dismissDataSet={{ testid: Handles.accountUnlinkDone }}
    />
  );
}
