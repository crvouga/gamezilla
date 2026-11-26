import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import type { JSX } from '@solidjs/web';
import { createSignal, Show } from 'solid-js';
import precision from '../game-screen/game-screen.module.css';
import { GameStageOverlayFrame } from '../game-stage-overlay/index';
import styles from '../game-ui.module.css';
import { createScreenSlot } from '../screen-slot';
import { GameBoardPreviewContext } from './board-presentation';
import componentStyles from './game-board-stage.module.css';
import { createStageRoomFit } from './room-fit';
import { createViewportSquareFit } from './viewport-fit';

export {
  GameBoardPreviewContext,
  useGameBoardPreview,
} from './board-presentation';

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
   * Covers the board with additional content, such as its result.
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
  /**
   * The board is a workspace that lays itself out (Word Tiles' rack, board
   * and view controls; Quoridor's board with its wall tools): never
   * narrowed to fit its room. A fixed stage gives it the same box as any
   * board, insets it from the screen's edges like the seats over it, and
   * it scrolls inside its box when taller (`data-board-workspace`).
   */
  workspace?: boolean | undefined;
  information?: JSX.Element;
  dataSet?: ComponentDataSet | undefined;
}): JSX.Element {
  const others = createScreenSlot(() => props.others);
  const turn = createScreenSlot(() => props.turn);
  const own = createScreenSlot(() => props.own);
  const players = () => (
    <>
      {others.content()}
      {turn.content()}
      {own.content()}
    </>
  );
  const overlay = createScreenSlot(() => props.overlay);
  const preview = (): boolean => props.preview === true;
  const [root, setRoot] = createSignal<HTMLDivElement>();
  const square = (): boolean => props.viewportFit === 'square' && !preview();
  // The board's region (`data-game-board`), whose box a layout may hold
  // fixed, and the game's content inside it, as tall as it draws.
  const [surface, setSurface] = createSignal<HTMLDivElement>();
  const [content, setContent] = createSignal<HTMLDivElement>();
  const limit = createViewportSquareFit(root, square, surface, content);
  const workspace = (): boolean => props.workspace === true;
  const room = createStageRoomFit(root, surface, () =>
    workspace() ? undefined : content()
  );
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
          [componentStyles['start'] ?? '']: props.align === 'start',
        },
      ]}
      data-preview={String(props.preview === true)}
      data-viewport-fit={props.viewportFit}
      style={{
        '--game-board-fit': limit() === undefined ? undefined : `${limit()}px`,
        '--game-board-room': room() === undefined ? undefined : `${room()}px`,
      }}
      data-game-board-stage
      data-board-narrowed={narrowed() ? 'true' : undefined}
      data-board-workspace={workspace() ? 'true' : undefined}
      {...dataAttrs({ component: 'GameBoardStage', ...props.dataSet })}
    >
      {/* Who plays and whose turn it is read over the board, the person's
          own seat with the others: under the board come only commands. */}
      <Show when={props.information !== undefined} fallback={players()}>
        <Show when={others.present() || own.present() || turn.present()}>
          <div class={componentStyles['players']} data-game-players>
            {players()}
          </div>
        </Show>
      </Show>
      {props.information}
      <BoardRegion
        surface={setSurface}
        content={setContent}
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
  preview: () => boolean;
  overlay: ReturnType<typeof createScreenSlot>;
  children: JSX.Element;
}): JSX.Element {
  return (
    <div
      ref={props.surface}
      class={`${styles['board']} ${componentStyles['region']}`}
      data-game-board
    >
      <div
        ref={props.content}
        class={[
          componentStyles['content'],
          { relative: props.overlay.present() },
        ]}
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
