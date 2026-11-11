import { Trans } from '@lingui/solid/macro';
import { MutationModal } from '@pkgs/ui-root-client-ts/mutation-modal';
import type { JSX } from 'solid-js';

/**
 * The destructive confirm before a publication leaves discovery. The
 * builder's shell owns it, so it stays whichever of the builder's small
 * screens is under it.
 */
export function ContentWithdrawConfirm(props: {
  visible: boolean;
  onClose: () => void;
  /** Withdraws the publication; rejects with what to tell the person. */
  onWithdraw: () => Promise<void>;
}): JSX.Element {
  return (
    <MutationModal
      visible={props.visible}
      onClose={() => props.onClose()}
      title={<Trans>Withdraw this publication?</Trans>}
      message={
        <Trans>
          It will leave discovery. Saved attempts and earlier pack editions keep
          their content.
        </Trans>
      }
      submitLabel={<Trans>Withdraw</Trans>}
      variant="destructive"
      successTitle={<Trans>Withdrawal saved</Trans>}
      operation={() => props.onWithdraw()}
      submitDataSet={{ testid: 'content-withdraw-confirm' }}
      dismissDataSet={{ testid: 'content-withdraw-dismiss' }}
    />
  );
}
