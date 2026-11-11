import { Trans } from '@lingui/solid/macro';
import {
  GameLobbyDock,
  GameModeCard,
} from '@pkgs/ui-root-client-ts/game-lobby';
import { type JSX, Show } from 'solid-js';
import {
  MultiplayerLobbyPlace,
  type MultiplayerPlaceFrame,
} from './multiplayer-place-frame';
import {
  type MultiplayerSearchView,
  MultiplayerStopSearch,
  MultiplayerWaiting,
} from './multiplayer-waiting';
import { timeControlWords } from './time-control-name';

/**
 * A search under way: what will be played, what the search is looking for
 * and how long it has looked, over its one command, stopping it, held at
 * the foot of the screen. An opponent found changes the stage, and the
 * game takes this place under its versus card.
 */
export function MultiplayerSearchingView(
  props: MultiplayerPlaceFrame & {
    readonly title: string;
    /** How the game is won, in one sentence, where the game says. */
    readonly goal?: string | undefined;
    readonly search: MultiplayerSearchView;
    readonly onStop: () => Promise<void>;
  }
): JSX.Element {
  return (
    <MultiplayerLobbyPlace
      {...props}
      dock={
        <GameLobbyDock>
          <MultiplayerStopSearch
            multiple={props.search.players > 2}
            onStop={props.onStop}
          />
        </GameLobbyDock>
      }
    >
      <GameModeCard
        eyebrow={<Trans>Ranked match</Trans>}
        title={props.title}
        summary={props.goal}
        facts={[
          {
            id: 'players',
            label: <Trans>Players</Trans>,
            value: props.search.players,
          },
          {
            id: 'clock',
            label: <Trans>Clock</Trans>,
            value: (
              <Show
                when={props.search.timeControl}
                fallback={<Trans>Untimed</Trans>}
              >
                {(control) => timeControlWords(control())}
              </Show>
            ),
          },
          {
            id: 'rating',
            label: <Trans>Rating</Trans>,
            value: <Trans>Rated</Trans>,
          },
        ]}
      />
      <MultiplayerWaiting search={props.search} />
    </MultiplayerLobbyPlace>
  );
}
