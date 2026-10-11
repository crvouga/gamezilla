import { Trans } from '@lingui/solid/macro';
import { MutationModal } from '@pkgs/ui-root-client/mutation-modal';
import { createSignal, type JSX, Match, Show, Switch } from 'solid-js';
import { MultiplayerFindPanel } from './multiplayer-find-panel';
import { MultiplayerGameActions } from './multiplayer-game-actions';
import { MultiplayerWaiting } from './multiplayer-waiting';
import type { MultiplayerControlsModel } from './use-multiplayer-controls';
import type { MultiplayerData } from './use-multiplayer-data';

type Confirm = 'resign' | 'abort';

function ConfirmTitle(props: { readonly kind: Confirm | null }): JSX.Element {
  return (
    <Switch fallback={<Trans>Resign multiplayer chess?</Trans>}>
      <Match when={props.kind === 'abort'}>
        <Trans>Abort the multiplayer game?</Trans>
      </Match>
    </Switch>
  );
}

function ConfirmMessage(props: { readonly kind: Confirm | null }): JSX.Element {
  return (
    <Switch fallback={<Trans>Your opponent will win this game.</Trans>}>
      <Match when={props.kind === 'abort'}>
        <Trans>The game ends with no result and no rating change.</Trans>
      </Match>
    </Switch>
  );
}

export function MultiplayerControls(props: {
  readonly controls: MultiplayerControlsModel;
  readonly data: MultiplayerData;
}): JSX.Element {
  const [confirm, setConfirm] = createSignal<Confirm | null>(null);
  const looking = () => props.data.search()?.standing === 'waiting';
  const operation = () => {
    const kind = confirm();
    if (kind === 'abort') return props.controls.abort();
    return props.controls.resign();
  };
  return (
    <>
      <Show when={props.data.game()}>
        {(game) => (
          <MultiplayerGameActions
            game={game()}
            myId={props.data.myId()}
            controls={props.controls}
            looking={looking()}
            onConfirm={setConfirm}
          />
        )}
      </Show>
      <Show
        when={looking() ? props.data.search() : null}
        fallback={
          <Show
            when={
              props.data.participant() ||
              props.data.hostId() === props.data.myId()
                ? props.data.game()?.outcome !== 'ongoing'
                : false
            }
          >
            <MultiplayerFindPanel controls={props.controls} />
          </Show>
        }
      >
        {(search) => (
          <MultiplayerWaiting search={search()} onStop={props.controls.stop} />
        )}
      </Show>
      <MutationModal
        visible={confirm() !== null}
        onClose={() => setConfirm(null)}
        title={<ConfirmTitle kind={confirm()} />}
        message={<ConfirmMessage kind={confirm()} />}
        operation={operation}
        submitLabel={<Trans>Confirm</Trans>}
        successTitle={<Trans>Multiplayer command accepted</Trans>}
        variant="destructive"
        submitDataSet={{ testid: 'multiplayer-confirm' }}
        dismissDataSet={{ testid: 'multiplayer-dismiss' }}
      />
    </>
  );
}
