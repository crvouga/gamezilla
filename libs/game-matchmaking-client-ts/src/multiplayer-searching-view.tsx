import { GameLobbyDock } from '@pkgs/ui-root-client-ts/game-lobby';
import type { JSX } from 'solid-js';
import {
  MultiplayerLobbyPlace,
  type MultiplayerPlaceFrame,
} from './multiplayer-place-frame';
import {
  type MultiplayerSearchView,
  MultiplayerStopSearch,
  MultiplayerWaiting,
} from './multiplayer-waiting';

/**
 * A search under way: the search alone, in the middle of the screen (what
 * it looks for, how long it has looked, what happens next), over its one
 * command, stopping it, held at the foot of the screen. An opponent found
 * changes the stage, and the game takes this place under its versus card.
 */
export function MultiplayerSearchingView(
  props: MultiplayerPlaceFrame & {
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
      <MultiplayerWaiting search={props.search} />
    </MultiplayerLobbyPlace>
  );
}
