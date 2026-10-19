import { Trans } from '@lingui/solid/macro';
import { Button } from '@pkgs/ui-root-client/button';
import { MutationModal } from '@pkgs/ui-root-client/mutation-modal';
import { VisuallyHidden } from '@pkgs/ui-root-client/visually-hidden';
import { createSignal, type JSX, Show } from 'solid-js';
import type { CustomGameScreenModel } from './use-custom-game-screen';

export function CustomGameConfirm(props: {
  model: CustomGameScreenModel;
  operation: 'cancel' | 'resign';
  available: boolean;
}): JSX.Element {
  // A new press replaces a dialog left on its error step.
  const [dialogSession, setDialogSession] = createSignal(0);
  const title = (): JSX.Element => (
    <Show
      when={props.operation === 'cancel'}
      fallback={<Trans>Resign game</Trans>}
    >
      <Trans>Cancel game</Trans>
    </Show>
  );
  // The row sits under the board, so the button need not repeat "game".
  const action = (): JSX.Element => (
    <Show
      when={props.operation === 'cancel'}
      fallback={
        <Trans>
          Resign<VisuallyHidden> game</VisuallyHidden>
        </Trans>
      }
    >
      <Trans>Cancel game</Trans>
    </Show>
  );
  return (
    <>
      <Show when={props.available}>
        <Button
          title={action()}
          intent="danger"
          variant="ghost"
          onClick={() => setDialogSession((current) => current + 1)}
          dataSet={{ testid: `custom-game-${props.operation}` }}
        />
      </Show>
      <Show when={dialogSession()} keyed>
        {(session) => (
          <MutationModal
            visible={session > 0}
            onClose={() => setDialogSession(0)}
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
            submitDataSet={{
              testid: `custom-game-${props.operation}-confirm`,
            }}
            dismissDataSet={{ testid: `custom-game-${props.operation}-done` }}
          />
        )}
      </Show>
    </>
  );
}
