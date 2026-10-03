import { Trans } from '@lingui/solid/macro';
import { Button, MutationModal } from '@pkgs/ui';
import { createSignal, type JSX, Show } from 'solid-js';
import type { CustomGameScreenModel } from './use-custom-game-screen';

export function CustomGameConfirm(props: {
  model: CustomGameScreenModel;
  operation: 'cancel' | 'resign';
  available: boolean;
}): JSX.Element {
  const [visible, setVisible] = createSignal(false);
  const title = (): JSX.Element => (
    <Show
      when={props.operation === 'cancel'}
      fallback={<Trans>Resign game</Trans>}
    >
      <Trans>Cancel game</Trans>
    </Show>
  );
  return (
    <>
      <Show when={props.available}>
        <Button
          title={title()}
          intent="danger"
          variant="outline"
          onClick={() => setVisible(true)}
          dataSet={{ testid: `chess-custom-${props.operation}` }}
        />
      </Show>
      <MutationModal
        visible={visible()}
        onClose={() => setVisible(false)}
        title={title()}
        message={
          <Trans>
            This finishes the current game. Its record remains available.
          </Trans>
        }
        operation={() => props.model.choose({ operation: props.operation })}
        submitLabel={title()}
        variant="destructive"
        successTitle={<Trans>Game finished</Trans>}
        submitDataSet={{ testid: `chess-custom-${props.operation}-confirm` }}
        dismissDataSet={{ testid: `chess-custom-${props.operation}-done` }}
      />
    </>
  );
}
