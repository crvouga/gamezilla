import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import { type JSX, Show } from 'solid-js';
import precision from '../game-screen/game-precision.module.css';
import styles from '../game-ui.module.css';
import { createScreenSlot } from '../screen-slot';
import boardAlign from './board-align.module.css';
import { GameBoardPreviewContext } from './board-preview';
import { createViewportSquareFit } from './viewport-fit';
import fit from './viewport-fit.module.css';

/**
 * The play surface and the people around it. The game supplies the
 * interactive surface; the stage keeps it the largest thing on the screen,
 * in reading order: the other players above it (one `GamePlayerBar`, or a
 * `GamePlayerRail` at a bigger table), then the board, then the turn
 * (`GameTurnPill`), then the person's own strip. An empty slot takes no room.
 * `preview` shows the board as a small thumbnail, in its own colours, over
 * a quiet `previewLabel` instead, while the game is still being set up: it
 * says which board, not where to play, so it never outweighs the setup. A board
 * with turn chrome of its own leaves it out there (`useGameBoardPreview`).
 */
export function GameBoardStage(props: {
  /** The other players, above the board. */
  others?: JSX.Element;
  /** Whose turn it is, between the board and the person's own strip. */
  turn?: JSX.Element;
  /** The person holding the device, below the board. */
  own?: JSX.Element;
  children: JSX.Element;
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
  const preview = (): boolean => props.preview === true;
  let root: HTMLDivElement | undefined;
  const square = (): boolean => props.viewportFit === 'square' && !preview();
  const limit = createViewportSquareFit(() => root, square);
  return (
    <div
      ref={root}
      class={`${styles['boardStage']} ${precision['board']}`}
      classList={{
        [boardAlign['start'] ?? '']: props.align === 'start',
        [fit['squareStage'] ?? '']: square(),
      }}
      data-preview={props.preview === true}
      data-viewport-fit={props.viewportFit}
      style={{
        '--game-board-fit': limit() === undefined ? undefined : `${limit()}px`,
      }}
      {...dataAttrs({ component: 'GameBoardStage', ...props.dataSet })}
    >
      <Show when={others.present()}>{others.content()}</Show>
      <div
        class={styles['board']}
        classList={{ [fit['squareBoard'] ?? '']: square() }}
      >
        <GameBoardPreviewContext.Provider value={preview}>
          {props.children}
        </GameBoardPreviewContext.Provider>
      </div>
      <Show when={props.preview === true && props.previewLabel}>
        <p class={`${styles['previewLabel']} text textFootnote`}>
          {props.previewLabel}
        </p>
      </Show>
      <Show when={turn.present()}>{turn.content()}</Show>
      <Show when={own.present()}>{own.content()}</Show>
    </div>
  );
}
