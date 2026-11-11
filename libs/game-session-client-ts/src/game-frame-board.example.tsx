import {
  type OpenedPlace,
  placeBehind,
  placeIn,
} from '@pkgs/turn-game-client-ts/screen-places';
import { createSignal, type JSX } from 'solid-js';
import { ConnectFourStoryBoard } from './connect-four-story-board.example';
import { CUSTOM_GAME_PLACES, type CustomGamePlace } from './custom-game-places';
import { recordReviewing } from './game-frame-moves-view';
import {
  GameFrameScreenView,
  type GameFrameScreenViewProps,
} from './game-frame-screen-view';
import { WON_LINE, WON_MOVES } from './game-frame-story.example';
import type { FramePhase } from './game-frame-view-types';

/**
 * The frame as a story shows it: opened on the story's place, and moving
 * between the phase's places as the app does (the same machine the
 * container reads), so every row and Back leads where it leads in the app.
 */
export function FrameStory(
  props: GameFrameScreenViewProps & {
    readonly board?: JSX.Element;
    readonly setupBoard?: JSX.Element;
  }
): JSX.Element {
  const [opened, setOpened] = createSignal<OpenedPlace<
    FramePhase,
    CustomGamePlace
  > | null>({ stage: props.phase, place: props.place });
  const place = (): CustomGamePlace =>
    placeIn(CUSTOM_GAME_PLACES, props.phase, opened());
  return (
    <GameFrameScreenView
      {...props}
      place={place()}
      onOpen={(next) => {
        props.onOpen(next);
        setOpened({ stage: props.phase, place: next });
      }}
      onClose={() => {
        props.onClose();
        const behind = placeBehind(CUSTOM_GAME_PLACES, props.phase, place());
        setOpened(
          behind === null ? null : { stage: props.phase, place: behind }
        );
      }}
    />
  );
}

/** The frame with Connect Four's board at the position `moves` reach. */
export function onBoard(moves: readonly number[]) {
  return (args: GameFrameScreenViewProps) => (
    <FrameStory
      {...args}
      board={
        <ConnectFourStoryBoard
          moves={moves}
          interactive={
            args.phase === 'active' &&
            !args.stopped &&
            (args.connection === 'online' ||
              args.connection === 'offline-local') &&
            !args.status?.sending &&
            !recordReviewing(args.record) &&
            args.viewerSide !== null &&
            args.table.near?.side === args.viewerSide &&
            args.table.near.deciding &&
            !args.table.near.standIn
          }
          winning={moves === WON_MOVES ? WON_LINE : undefined}
        />
      }
    />
  );
}
