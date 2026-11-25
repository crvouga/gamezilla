import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import type { JSX } from '@solidjs/web';
import { createSignal, Show } from 'solid-js';
import precision from '../game-screen/game-precision.module.css';
import { GameStageOverlayFrame } from '../game-stage-overlay/index';
import styles from '../game-ui.module.css';
import { createScreenSlot } from '../screen-slot';
import boardAlign from './board-align.module.css';
import { GameBoardPreviewContext } from './board-preview';
import region from './board-region.module.css';
import { createBoardRegionFill } from './region-fill';
import { createStageRoomFit } from './room-fit';
import { createStageCentre } from './stage-centre';
import { createViewportSquareFit } from './viewport-fit';
import fit from './viewport-fit.module.css';

export { GameBoardPreviewContext, useGameBoardPreview } from './board-preview';

/**
 * The play surface and the people around it. The game supplies the
 * interactive surface; the stage keeps it the largest thing on the screen,
 * in reading order: everything said about the game over it (the other
 * players, one `GamePlayerBar` or a `GamePlayerRail` at a bigger table,
 * then the turn, `GameTurnPill`, then the person's own strip), then the
 * board, so only commands ever sit under it. An empty slot takes no room.
 * `preview` shows the board as a small thumbnail, in its own colours, over
 * a quiet `previewLabel` instead, while the game is still being set up: it
 * says which board, not where to play, so it never outweighs the setup. A board
 * with turn chrome of its own leaves it out there (`useGameBoardPreview`).
 */
export function GameBoardStage(props: {
  /** The other players, above the board. */
  others?: JSX.Element;
  /** Whose turn it is, between the other players and the person's own strip. */
  turn?: JSX.Element;
  /** The person holding the device, over the board with the others. */
  own?: JSX.Element;
  children: JSX.Element;
  /**
   * Over the board, covering it and nothing else: who plays whom before
   * the game (`GameVersusOverlay`), how it ended (`GameResultOverlay`).
   * The board keeps its place under it; an empty slot covers nothing.
   */
  overlay?: JSX.Element | undefined;
  /** A thumbnail of the board, before there is play to show. */
  preview?: boolean | undefined;
  /** Under the thumbnail, what it is (`Board preview`). */
  previewLabel?: JSX.Element | undefined;
  /** Fit square content and its chrome on larger viewports, with a target floor. */
  viewportFit?: 'square' | undefined;
  /**
   * On one column, start at the column's edge (the game title's) instead of
   * its centre. Absent: centred.
   */
  align?: 'start' | undefined;
  dataSet?: ComponentDataSet | undefined;
}): JSX.Element {
  const others = createScreenSlot(() => props.others);
  const turn = createScreenSlot(() => props.turn);
  const own = createScreenSlot(() => props.own);
  const overlay = createScreenSlot(() => props.overlay);
  const preview = (): boolean => props.preview === true;
  const [root, setRoot] = createSignal<HTMLDivElement>();
  const square = (): boolean => props.viewportFit === 'square' && !preview();
  // The board's region (`data-game-board`), whose box a layout may hold
  // fixed, and the game's content inside it, as tall as it draws.
  const [surface, setSurface] = createSignal<HTMLDivElement>();
  const [content, setContent] = createSignal<HTMLDivElement>();
  const limit = createViewportSquareFit(root, square, surface, content);
  const room = createStageRoomFit(root, surface, content);
  // A fixed stage sits in the middle of its room, and stays there.
  const centre = createStageCentre(root, surface);
  // The window's height left under the region's top, for a layout that
  // holds the region at that height (`--game-board-viewport-room`).
  const fill = createBoardRegionFill(root, surface, () => !preview());
  // Narrower than its room: the board stands clear of the screen's edges.
  const narrowed = (): boolean => {
    const limit = room();
    const cell = root()?.parentElement;
    return limit !== undefined && !!cell && limit < cell.clientWidth - 1;
  };
  return (
    <div
      ref={setRoot}
      class={[
        `${styles['boardStage']} ${precision['board']}`,
        {
          [boardAlign['start'] ?? '']: props.align === 'start',
          [fit['squareStage'] ?? '']: square(),
        },
      ]}
      data-preview={String(props.preview === true)}
      data-viewport-fit={props.viewportFit}
      style={{
        '--game-board-fit': limit() === undefined ? undefined : `${limit()}px`,
        '--game-board-room': room() === undefined ? undefined : `${room()}px`,
        '--game-stage-offset':
          centre() === undefined ? undefined : `${centre()}px`,
        '--game-board-viewport-room':
          fill() === undefined ? undefined : `${fill()}px`,
      }}
      data-game-board-stage
      data-board-narrowed={narrowed() ? 'true' : undefined}
      {...dataAttrs({ component: 'GameBoardStage', ...props.dataSet })}
    >
      {/* Who plays and whose turn it is read over the board, the person's
          own seat with the others: under the board come only commands. */}
      <Show when={others.present()}>{others.content()}</Show>
      <Show when={turn.present()}>{turn.content()}</Show>
      <Show when={own.present()}>{own.content()}</Show>
      <BoardRegion
        surface={setSurface}
        content={setContent}
        square={square()}
        preview={preview}
        overlay={overlay}
      >
        {props.children}
      </BoardRegion>
      <Show when={props.preview === true && props.previewLabel}>
        <p class={`${styles['previewLabel']} text textFootnote`}>
          {props.previewLabel}
        </p>
      </Show>
    </div>
  );
}

/**
 * The board's region (`data-game-board`) and the game's content in it.
 * The region is the box a layout holds still (a fixed stage gives it the
 * room left between the seats and the commands); the content is as tall
 * as the game draws it, at the region's top, and scrolls inside it when
 * taller. Anywhere else the region is as tall as its content. The overlay
 * covers the content: the board as drawn, not the room under it.
 */
function BoardRegion(props: {
  surface: (element: HTMLDivElement) => void;
  content: (element: HTMLDivElement) => void;
  square: boolean;
  preview: () => boolean;
  overlay: ReturnType<typeof createScreenSlot>;
  children: JSX.Element;
}): JSX.Element {
  return (
    <div
      ref={props.surface}
      class={[
        `${styles['board']} ${region['region']}`,
        { [fit['squareBoard'] ?? '']: props.square },
      ]}
      data-game-board
    >
      <div
        ref={props.content}
        class={[region['content'], { relative: props.overlay.present() }]}
        data-game-board-content
      >
        <GameBoardPreviewContext value={props.preview}>
          {props.children}
        </GameBoardPreviewContext>
        <Show when={props.overlay.present()}>
          <GameStageOverlayFrame>
            {props.overlay.content()}
          </GameStageOverlayFrame>
        </Show>
      </div>
    </div>
  );
}
