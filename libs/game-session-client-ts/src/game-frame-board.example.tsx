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
import type { JSX } from '@solidjs/web';
import { createEffect, createSignal, untrack } from 'solid-js';
import { ConnectFourStoryBoard } from './connect-four-story-board.example';
import { CUSTOM_GAME_PLACES, type CustomGamePlace } from './custom-game-places';
import {
  CustomGameScreenView,
  type CustomGameScreenViewProps,
} from './custom-game-screen-view';
import { recordReviewing } from './game-frame-moves-view';
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
  props: CustomGameScreenViewProps & {
    readonly board?: JSX.Element;
    readonly setupBoard?: JSX.Element;
  }
): JSX.Element {
  const [opened, setOpened] = createSignal<OpenedPlace<
    FramePhase,
    CustomGamePlace
    // The story opens on its own place: read once, then the person moves.
  > | null>(untrack(() => ({ stage: props.phase, place: props.place })));
  const place = (): CustomGamePlace =>
    placeIn(CUSTOM_GAME_PLACES, props.phase, opened());
  // The story's overlay starts as given: read once, then events move it.
  const [overlay, setOverlay] = createSignal<StageOverlay>(
    untrack(() => props.overlay)
  );
  // The story's phase moves the overlay as the app's does; the count is
  // the story's own (a still card), so no picture depends on time.
  createEffect(
    () => overlayPhase(props.phase),
    (to, seen) => {
      if (seen === undefined) return;
      const event = stageOverlayPhaseEvent(seen, to);
      if (event !== null)
        setOverlay((state) => stageOverlayAfter(state, event));
    }
  );
  return (
    <CustomGameScreenView
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
  return (args: CustomGameScreenViewProps) => (
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
          // The line under the board says where to choose: no second
          // prompt. A draw offered to the viewer is answered first.
          prompt={
            args.table.near?.choosing === true
              ? ''
              : args.play.canAnswerDraw
                ? 'Drop a disc to decline and play on'
                : undefined
          }
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
  return (args: CustomGameScreenViewProps) => {
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
              const played = [...drops(), column];
              setDrops(played);
              setPly(played.length);
            }}
          />
        }
      />
    );
  };
}
