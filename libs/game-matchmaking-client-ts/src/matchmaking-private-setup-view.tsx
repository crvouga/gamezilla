import { FixedGameSession } from '@pkgs/ui-root-client-ts/game-session-layout';
import type { JSX } from '@solidjs/web';
import type { MultiplayerBoardSlot } from './matchmaking-screen-view';
import { MultiplayerCommandsControl } from './matchmaking-stage-view';
import type { MultiplayerGameView } from './multiplayer-game-view';
import {
  type MultiplayerPlaceFrame,
  MultiplayerStagePlace,
} from './multiplayer-place-frame';
import type { MultiplayerPlace } from './multiplayer-places';

/**
 * A matched game waiting for its private setups: the person's own setup
 * to arrange and choose (or who is still getting ready, once they have,
 * and for a watcher), the board it will be played on, and one control that
 * opens the game's commands. The first move changes the stage, and play
 * takes this place.
 */
export function MatchmakingPrivateSetupView(
  props: MultiplayerPlaceFrame & {
    readonly title: string;
    /** The person's own setup, its commands and who is ready. */
    readonly setup: JSX.Element;
    /** The seats around the board. */
    readonly board: MultiplayerBoardSlot | undefined;
    /** The line that says who is still getting ready. */
    readonly status: JSX.Element;
    readonly game: MultiplayerGameView;
    readonly onOpen: (place: MultiplayerPlace) => void;
  }
): JSX.Element {
  return (
    <MultiplayerStagePlace {...props} title={props.title}>
      <FixedGameSession
        notices={props.notices}
        status={props.status}
        actions={
          <MultiplayerCommandsControl
            game={props.game}
            stage={props.stage}
            onOpen={props.onOpen}
          />
        }
      >
        {(information) =>
          props.board?.({ information, setup: props.setup }) ?? (
            <>
              {information}
              {props.setup}
            </>
          )
        }
      </FixedGameSession>
    </MultiplayerStagePlace>
  );
}
