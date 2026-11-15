import {
  type OpenedPlace,
  placeBehind,
  placeIn,
} from '@pkgs/turn-game-client-ts/screen-places';
import {
  type StageOverlay,
  type StageOverlayPhase,
  stageOverlayAfter,
  stageOverlayPhaseEvent,
} from '@pkgs/turn-game-client-ts/stage-overlay';
import { createComputed, createSignal, type JSX, on } from 'solid-js';
import { ConnectFourStoryBoard } from './connect-four-story-board.example';
import { CUSTOM_GAME_PLACES, type CustomGamePlace } from './custom-game-places';
import { recordReviewing } from './game-frame-moves-view';
import {
  GameFrameScreenView,
  type GameFrameScreenViewProps,
} from './game-frame-screen-view';
import { record, WON_LINE, WON_MOVES } from './game-frame-story.example';
import type { FramePhase } from './game-frame-view-types';

function overlayPhase(phase: FramePhase): StageOverlayPhase {
  if (phase === 'active') return 'play';
  return phase === 'completed' || phase === 'cancelled' ? 'over' : 'setup';
}

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
  const [overlay, setOverlay] = createSignal<StageOverlay>(props.overlay);
  // The story's phase moves the overlay as the app's does; the count is
  // the story's own (a still card), so no picture depends on time.
  let seen = overlayPhase(props.phase);
  createComputed(
    on(
      () => overlayPhase(props.phase),
      (to) => {
        const event = stageOverlayPhaseEvent(seen, to);
        seen = to;
        if (event !== null)
          setOverlay((state) => stageOverlayAfter(state, event));
      },
      { defer: true }
    )
  );
  return (
    <GameFrameScreenView
      boardPreview={<ConnectFourStoryBoard moves={[]} />}
      {...props}
      overlay={overlay()}
      onOverlay={(event) => {
        props.onOverlay(event);
        setOverlay((state) => stageOverlayAfter(state, event));
      }}
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
            // A secret choice is made on the seat, not by a drop.
            !args.table.near.choosing &&
            !args.table.near.standIn
          }
          winning={moves === WON_MOVES ? WON_LINE : undefined}
        />
      }
    />
  );
}

/**
 * The moves place over a game of `all` drops, its steps, its line of moves
 * and its move-number field live: choosing a position moves the board and
 * the line to it, as the app's moves place does.
 */
export function onReview(all: readonly number[]) {
  return (args: GameFrameScreenViewProps) => {
    // The game as it stands: its drops, and any played in the story.
    const [drops, setDrops] = createSignal<readonly number[]>(all);
    const [ply, setPly] = createSignal(args.record?.displayedPly ?? all.length);
    const live = (): boolean => ply() === drops().length;
    // Red circle (the viewer) moves on an even count of drops.
    const ownTurn = (): boolean => drops().length % 2 === 0;
    const played = () => record(drops().map((column) => String(column + 1)));
    return (
      <FrameStory
        {...args}
        record={
          args.record === null
            ? null
            : {
                ...args.record,
                moves: played().moves,
                movers: played().movers,
                displayedPly: ply(),
              }
        }
        status={
          args.status === null
            ? null
            : {
                ...args.status,
                description: ownTurn()
                  ? 'Red circle to move.'
                  : 'Yellow diamond to move.',
                emphasis: ownTurn() ? 'yours' : 'neutral',
              }
        }
        table={{
          ...args.table,
          near:
            args.table.near === null
              ? null
              : { ...args.table.near, deciding: ownTurn() },
          others: args.table.others.map((seat) => ({
            ...seat,
            deciding: !ownTurn(),
          })),
        }}
        onSeek={(next) => {
          args.onSeek(next);
          if (next >= 0 && next <= drops().length) setPly(next);
        }}
        // Leaving the moves returns the board to the game as it stands.
        onClose={() => {
          args.onClose();
          setPly(drops().length);
        }}
        board={
          <ConnectFourStoryBoard
            moves={drops().slice(0, ply())}
            interactive={args.phase === 'active' && live() && ownTurn()}
            onDrop={(column) => {
              setDrops([...drops(), column]);
              setPly(drops().length);
            }}
          />
        }
      />
    );
  };
}
