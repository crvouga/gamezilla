import type { MultiplayerGame } from '@libs/game-matchmaking-shared-ts/game-state';
import { multiplayerSides } from '@libs/game-matchmaking-shared-ts/multiplayer-roster';
import { Trans } from '@lingui/solid/macro';
import { MutationModal } from '@pkgs/ui-root-client-ts/mutation-modal';
import { createSignal, type JSX, Match, Show, Switch } from 'solid-js';
import { MultiplayerFindPanel } from './multiplayer-find-panel';
import { MultiplayerGameActions } from './multiplayer-game-actions';
import { MultiplayerWaiting } from './multiplayer-waiting';
import type { MultiplayerControlsModel } from './use-multiplayer-controls';
import type { MultiplayerData } from './use-multiplayer-data';

type Confirm = 'resign' | 'abort';

function ConfirmTitle(props: { readonly kind: Confirm | null }): JSX.Element {
  return (
    <Switch fallback={<Trans>Resign multiplayer game?</Trans>}>
      <Match when={props.kind === 'abort'}>
        <Trans>Abort the multiplayer game?</Trans>
      </Match>
    </Switch>
  );
}

function ConfirmMessage(props: {
  readonly kind: Confirm | null;
  readonly game: MultiplayerGame | null;
}): JSX.Element {
  return (
    <Switch fallback={<Trans>Your opponent will win this game.</Trans>}>
      <Match when={props.kind === 'abort'}>
        <Trans>The game ends with no result and no rating change.</Trans>
      </Match>
      <Match
        when={props.game !== null && multiplayerSides(props.game).length > 2}
      >
        <Trans>The round will end in a draw for all players.</Trans>
      </Match>
    </Switch>
  );
}

/**
 * What comes after a game, or before the first: the search under way, or
 * the choice of a time control for a new one. A watcher is offered neither.
 */
function MultiplayerNextGame(props: {
  readonly controls: MultiplayerControlsModel;
  readonly data: MultiplayerData;
}): JSX.Element {
  const waiting = () =>
    props.data.search()?.standing === 'waiting' ? props.data.search() : null;
  const mayFind = () =>
    (props.data.participant() || props.data.hostId() === props.data.myId()) &&
    props.data.game()?.outcome !== 'ongoing';
  return (
    <Switch>
      <Match when={waiting()}>
        {(search) => (
          <MultiplayerWaiting search={search()} onStop={props.controls.stop} />
        )}
      </Match>
      <Match when={mayFind()}>
        <MultiplayerFindPanel
          controls={props.controls}
          gameId={props.data.gameId()}
        />
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
            execution={props.data.execution()}
            myId={props.data.myId()}
            controls={props.controls}
            looking={looking()}
            onConfirm={setConfirm}
          />
        )}
      </Show>
      <MultiplayerNextGame data={props.data} controls={props.controls} />
      <MutationModal
        visible={confirm() !== null}
        onClose={() => setConfirm(null)}
        title={<ConfirmTitle kind={confirm()} />}
        message={<ConfirmMessage kind={confirm()} game={props.data.game()} />}
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
