import { GameSessionLayout } from '@pkgs/ui-root-client-ts/game-session-layout';
import type { JSX } from 'solid-js';
import type { MultiplayerGameView } from './multiplayer-game-view';
import {
  type MultiplayerPlaceFrame,
  MultiplayerStagePlace,
} from './multiplayer-place-frame';
import type { MultiplayerPlace } from './multiplayer-places';
import { MultiplayerCommandsControl } from './multiplayer-play-view';

/**
 * A matched game waiting for its private setups: the person's own setup
 * to arrange and choose (or who is still getting ready, once they have,
 * and for a watcher), the board it will be played on, and one control that
 * opens the game's commands. The first move changes the stage, and play
 * takes this place.
 */
export function MultiplayerPrivateSetupView(
  props: MultiplayerPlaceFrame & {
    readonly title: string;
    /** The person's own setup, its commands and who is ready. */
    readonly setup: JSX.Element;
    /** The seats around the board. */
    readonly board: JSX.Element;
    /** The line that says who is still getting ready. */
    readonly status: JSX.Element;
    readonly game: MultiplayerGameView;
    readonly onOpen: (place: MultiplayerPlace) => void;
  }
): JSX.Element {
  return (
    <MultiplayerStagePlace {...props} title={props.title}>
      <GameSessionLayout
        notices={props.notices}
        setup={props.setup}
        actionsBeside
        status={props.status}
        actions={
          <MultiplayerCommandsControl
            game={props.game}
            stage={props.stage}
            onOpen={props.onOpen}
          />
        }
      >
        {props.board}
      </GameSessionLayout>
    </MultiplayerStagePlace>
  );
}
