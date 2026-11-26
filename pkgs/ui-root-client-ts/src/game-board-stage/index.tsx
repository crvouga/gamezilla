import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import { createSignal, type JSX, onCleanup, Show } from 'solid-js';
import styles from '../game-ui.module.css';
import { observeElementResize } from '../observe-element-resize';
import { createScreenSlot } from '../screen-slot';
import { useGameBoardLead } from './board-lead';
import { GameBoardPreviewContext } from './board-preview';

/**
 * Tells the `GameLayout` around the stage how far its board sits below the
 * stage's top (the seat above it), so the rail beside a wide board starts
 * level with the board. A preview reports nothing: it is not beside a rail.
 */
function useReportBoardLead(preview: () => boolean): {
  readonly root: (element: HTMLElement) => void;
  readonly board: (element: HTMLElement) => void;
} {
  const report = useGameBoardLead();
  const [root, setRoot] = createSignal<HTMLElement>();
  const [board, setBoard] = createSignal<HTMLElement>();
  const read = (): void => {
    const top = root()?.getBoundingClientRect().top;
    const boardTop = board()?.getBoundingClientRect().top;
    if (top === undefined || boardTop === undefined || preview()) {
      report(0);
      return;
    }
    report(Math.max(0, Math.round(boardTop - top)));
  };
  const watch = (element: HTMLElement): void => {
    queueMicrotask(read);
    const stop = observeElementResize(element, read);
    onCleanup(stop);
  };
  onCleanup(() => report(0));
  return {
    root: (element) => {
      setRoot(element);
      watch(element);
    },
    board: (element) => {
      setBoard(element);
    },
  };
}

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
  dataSet?: ComponentDataSet | undefined;
}): JSX.Element {
  const others = createScreenSlot(() => props.others);
  const turn = createScreenSlot(() => props.turn);
  const own = createScreenSlot(() => props.own);
  const preview = (): boolean => props.preview === true;
  const lead = useReportBoardLead(preview);
  return (
    <div
      ref={lead.root}
      class={styles['boardStage']}
      data-preview={props.preview === true}
      {...dataAttrs({ component: 'GameBoardStage', ...props.dataSet })}
    >
      <Show when={others.present()}>{others.content()}</Show>
      <div ref={lead.board} class={styles['board']}>
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
