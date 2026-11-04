import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import { type JSX, Show } from 'solid-js';
import styles from '../game-ui.module.css';
import { createScreenSlot } from '../screen-slot';
import { GameBoardPreviewContext } from './board-preview';

/**
 * The play surface and the people around it. The game supplies the
 * interactive surface; the stage keeps it the largest thing on the screen,
 * in reading order: the other players above it (one `GamePlayerBar`, or a
 * `GamePlayerRail` at a bigger table), then the board, then the turn
 * (`GameTurnPill`), then the person's own strip. An empty slot takes no room.
 * `preview` shows the board as a small, dimmed thumbnail under its
 * `previewLabel` instead, while the game is still being set up: it says
 * which board, not where to play, so it never outweighs the setup. A board
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
  /** Over the thumbnail, what it is (`Board preview`). */
  previewLabel?: JSX.Element | undefined;
  dataSet?: ComponentDataSet | undefined;
}): JSX.Element {
  const others = createScreenSlot(() => props.others);
  const turn = createScreenSlot(() => props.turn);
  const own = createScreenSlot(() => props.own);
  const preview = (): boolean => props.preview === true;
  return (
    <div
      class={styles['boardStage']}
      data-preview={props.preview === true}
      {...dataAttrs({ component: 'GameBoardStage', ...props.dataSet })}
    >
      <Show when={others.present()}>{others.content()}</Show>
      <Show when={props.preview === true && props.previewLabel}>
        <p class={`${styles['previewLabel']} text textFootnote`}>
          {props.previewLabel}
        </p>
      </Show>
      <div class={styles['board']}>
        <GameBoardPreviewContext.Provider value={preview}>
          {props.children}
        </GameBoardPreviewContext.Provider>
      </div>
      <Show when={turn.present()}>{turn.content()}</Show>
      <Show when={own.present()}>{own.content()}</Show>
    </div>
  );
}
