import type { JSX } from 'solid-js';
import {
  MultiplayerMenuPlace,
  type MultiplayerPlaceFrame,
} from './multiplayer-place-frame';
import {
  type MultiplayerSearchView,
  MultiplayerWaiting,
} from './multiplayer-waiting';

/**
 * A search under way: what it is looking for, how long it has looked, and
 * its one command, stopping it. An opponent found changes the stage, and
 * the game takes this place.
 */
export function MultiplayerSearchingView(
  props: MultiplayerPlaceFrame & {
    readonly title: string;
    readonly search: MultiplayerSearchView;
    readonly onStop: () => Promise<void>;
  }
): JSX.Element {
  return (
    <MultiplayerMenuPlace {...props} title={props.title}>
      <MultiplayerWaiting search={props.search} onStop={props.onStop} />
    </MultiplayerMenuPlace>
  );
}
