import { withdrawPuzzleContentMutation } from '@libs/game-puzzle-shared-ts/withdraw-content-mutation';
import { Trans, useLingui } from '@lingui/solid/macro';
import { useMutationClient } from '@pkgs/sync-engine-client-ts/mutation-client-context';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { MutationModal } from '@pkgs/ui-root-client-ts/mutation-modal';
import { createSignal, type JSX } from 'solid-js';

export function ContentWithdraw(props: {
  documentId: string;
  disabled: boolean;
}): JSX.Element {
  const { t } = useLingui();
  const mutations = useMutationClient();
  const [visible, setVisible] = createSignal(false);
  const withdraw = async (): Promise<void> => {
    const result = await mutations.mutate(withdrawPuzzleContentMutation, {
      documentId: props.documentId,
    });
    if (!result.ok)
      throw new Error(
        result.failures[0]?.message ??
          t`The publication could not be withdrawn. Try again.`
      );
  };
  return (
    <>
      <Button
        title={t`Withdraw publication`}
        intent="neutral"
        variant="outline"
        onClick={() => setVisible(true)}
        disabled={props.disabled}
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
        operation={withdraw}
      />
    </>
  );
}
