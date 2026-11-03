import { Trans, useLingui } from '@lingui/solid/macro';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { MutationModal } from '@pkgs/ui-root-client-ts/mutation-modal';
import { createSignal, type JSX } from 'solid-js';

/** Withdraw a publication from discovery, after a destructive confirm. */
export function ContentWithdraw(props: {
  disabled: boolean;
  /** Withdraws the publication; rejects with what to tell the person. */
  onWithdraw: () => Promise<void>;
}): JSX.Element {
  const { t } = useLingui();
  const [visible, setVisible] = createSignal(false);
  return (
    <>
      <Button
        title={t`Withdraw publication`}
        intent="neutral"
        variant="outline"
        onClick={() => setVisible(true)}
        disabled={props.disabled}
        dataSet={{ testid: 'content-withdraw' }}
      />
      <MutationModal
        visible={visible()}
        onClose={() => setVisible(false)}
        title={<Trans>Withdraw this publication?</Trans>}
        message={
          <Trans>
            It will leave discovery. Saved attempts and earlier pack editions
            keep their content.
          </Trans>
        }
        submitLabel={<Trans>Withdraw</Trans>}
        variant="destructive"
        successTitle={<Trans>Withdrawal saved</Trans>}
        operation={() => props.onWithdraw()}
        submitDataSet={{ testid: 'content-withdraw-confirm' }}
        dismissDataSet={{ testid: 'content-withdraw-dismiss' }}
      />
    </>
  );
}
