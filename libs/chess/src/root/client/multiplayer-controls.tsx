import { Trans } from '@lingui/solid/macro';
import { Button, MutationModal, useMutationButton } from '@pkgs/ui';
import { createSignal, type JSX, Show } from 'solid-js';
import type { useMultiplayerControls } from './use-multiplayer-controls';
import type { useMultiplayerData } from './use-multiplayer-data';

export function MultiplayerControls(props: {
  readonly controls: ReturnType<typeof useMultiplayerControls>;
  readonly data: ReturnType<typeof useMultiplayerData>;
  readonly requestedGame: string | undefined;
}): JSX.Element {
  const [confirm, setConfirm] = createSignal<'stop' | 'resign' | null>(null);
  const begin = useMutationButton({
    operation: () => props.controls.begin(),
    labels: {
      idle: <Trans>Find a chess opponent</Trans>,
      loading: <Trans>Finding an opponent…</Trans>,
      success: <Trans>Opponent search accepted</Trans>,
      error: <Trans>Try finding an opponent again</Trans>,
    },
  });
  return (
    <div class="box gap-4" data-component="MultiplayerControls">
      <Show when={props.data.game()?.outcome === 'ongoing'}>
        <Button
          title={<Trans>Resign multiplayer chess</Trans>}
          onClick={() => setConfirm('resign')}
          dataSet={{ testid: 'multiplayer-resign' }}
        />
      </Show>
      <Show
        when={props.data.search()?.standing === 'waiting'}
        fallback={
          <Show when={props.requestedGame === undefined}>
            <Button
              {...begin.buttonProps}
              dataSet={{ testid: 'multiplayer-find' }}
            />
          </Show>
        }
      >
        <p role="status" data-testid="multiplayer-waiting">
          <Trans>Looking for a chess opponent.</Trans>
        </p>
        <Button
          title={<Trans>Stop finding an opponent</Trans>}
          onClick={() => setConfirm('stop')}
          dataSet={{ testid: 'multiplayer-stop' }}
        />
      </Show>
      <MutationModal
        visible={confirm() !== null}
        onClose={() => setConfirm(null)}
        title={
          confirm() === 'stop' ? (
            <Trans>Stop finding an opponent?</Trans>
          ) : (
            <Trans>Resign multiplayer chess?</Trans>
          )
        }
        message={
          confirm() === 'stop' ? (
            <Trans>Your search will end.</Trans>
          ) : (
            <Trans>Your opponent will win this game.</Trans>
          )
        }
        operation={() =>
          confirm() === 'stop' ? props.controls.stop() : props.controls.resign()
        }
        submitLabel={<Trans>Confirm</Trans>}
        successTitle={<Trans>Multiplayer command accepted</Trans>}
        variant="destructive"
        submitDataSet={{ testid: 'multiplayer-confirm' }}
        dismissDataSet={{ testid: 'multiplayer-dismiss' }}
      />
    </div>
  );
}
