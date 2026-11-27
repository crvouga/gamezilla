/** @jsxImportSource @solidjs/web */

import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import type { JSX } from '@solidjs/web';
import { Show } from 'solid-js';
import { createScreenSlot } from '../screen-slot';
import { Spinner } from '../spinner/index';
import styles from './game-search-stage.module.css';

export type GameSearchStageProps = {
  /** What the search is doing, in a word or two (`Searching…`). */
  title: JSX.Element;
  /** What is being looked for. Announced politely as it changes. */
  description: JSX.Element;
  /** The elapsed time, already worded by the caller ("12 seconds"). */
  elapsed: JSX.Element;
  /**
   * In place of the spinner while the search cannot run (no connection):
   * a still mark, so nothing seems to be looking.
   */
  mark?: JSX.Element | undefined;
  /**
   * Under the stage: who is searching and the clock they chose, as a seat
   * strip (a `GamePlayerBar`), where the game's own seat will be.
   */
  seat?: JSX.Element | undefined;
  dataSet?: ComponentDataSet | undefined;
};

/**
 * `GameSearchStage` -- waiting for an opponent, drawn where the board will
 * be: a board-sized, still board carrying one line of state over its
 * squares (spinner, `Searching…`, what is sought, how long), with the
 * person's own seat strip under it. The stop command is the screen's dock,
 * so the search reads as the game's first state and never as a card among
 * cards.
 *
 * @example
 * ```tsx
 * <GameSearchStage
 *   title="Searching…"
 *   description="Looking for a 5+3 Connect Four opponent."
 *   elapsed="12 seconds"
 *   seat={<GamePlayerBar name="River" />}
 * />
 * ```
 */
export function GameSearchStage(props: GameSearchStageProps): JSX.Element {
  const seat = createScreenSlot(() => props.seat);
  return (
    <section
      class={styles['stage']}
      {...dataAttrs({ component: 'GameSearchStage', ...props.dataSet })}
    >
      <div class={styles['board']} data-game-slot="search-board">
        <div class={styles['state']}>
          <Show when={props.mark} fallback={<Spinner size="lg" color="current" />}>
            {props.mark}
          </Show>
          <h2 class={styles['title']}>{props.title}</h2>
          <div class={styles['line']} role="status" aria-live="polite">
            {props.description}
          </div>
          <div class={styles['elapsed']} role="timer" aria-live="off">
            {props.elapsed}
          </div>
        </div>
      </div>
      <Show when={seat.present()}>
        <div class={styles['seat']} data-game-slot="search-seat">
          {seat.content()}
        </div>
      </Show>
    </section>
  );
}
