import { Trans } from '@pkgs/lingui-solid-client-ts/macro';
import {
  GameLobbyDock,
  GameModeCard,
} from '@pkgs/ui-root-client-ts/game-lobby';
import type { JSX } from '@solidjs/web';
import { Show } from 'solid-js';
import {
  MultiplayerLobbyPlace,
  type MultiplayerPlaceFrame,
} from './multiplayer-place-frame';
import {
  type MultiplayerSearchView,
  type MultiplayerSearchYou,
  MultiplayerStopSearch,
  MultiplayerWaiting,
} from './multiplayer-waiting';

/**
 * A search under way: what will be played (in the search's own one-line
 * card: ranked, rated), then the wait drawn where the board will be
 * (`Searching…`, what is sought, how long) over the person's seat with
 * the clock they chose, and the one command, stopping it, held at the foot
 * of the screen. An opponent found changes the stage, and the game's board
 * takes this place once setup is complete.
 */
export function MultiplayerSearchingView(
  props: MultiplayerPlaceFrame & {
    readonly search: MultiplayerSearchView;
    readonly onStop: () => Promise<void>;
    /** Who is searching, for the seat under the waiting board. */
    readonly you?: MultiplayerSearchYou | undefined;
    /** No connection: the search card says it waits and resumes. */
    readonly offline?: boolean | undefined;
  }
): JSX.Element {
  return (
    <MultiplayerLobbyPlace
      {...props}
      dock={
        <GameLobbyDock>
          <MultiplayerStopSearch
            multiple={props.search.players > 2}
            offline={props.offline === true}
            onStop={props.onStop}
          />
        </GameLobbyDock>
      }
    >
      <GameModeCard
        eyebrow={
          <>
            <Trans>Ranked match</Trans>
            {'\u00a0· '}
            <Trans>Rated</Trans>
            {/* A timed search's clock is on the person's seat, said once;
                an untimed one says so here, in its one line. */}
            <Show when={props.search.timeControl === null}>
              {'\u00a0· '}
              <Trans>Untimed</Trans>
            </Show>
          </>
        }
        title={props.search.gameName}
        summary={props.search.goal}
      />
      <MultiplayerWaiting
        search={props.search}
        you={props.you}
        offline={props.offline}
      />
    </MultiplayerLobbyPlace>
  );
}
