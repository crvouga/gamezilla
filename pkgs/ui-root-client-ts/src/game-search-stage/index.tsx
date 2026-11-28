/** @jsxImportSource @solidjs/web */

import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import type { JSX } from '@solidjs/web';
import { Show } from 'solid-js';
import { GameTile, type GameTileMotif } from '../game-tile';
import { createScreenSlot } from '../screen-slot';
import { Spinner } from '../spinner/index';
import styles from './game-search-stage.module.css';

export type GameSearchStageProps = {
  motif: GameTileMotif;
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
 * The selected game’s tile sits above the matchmaking status and elapsed time.
 * The player’s seat follows the stage and Stop stays in the screen dock.
 *
 * @example
 * ```tsx
 * <GameSearchStage
 *   motif="discs"
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
          <GameTile motif={props.motif} size="xl" />
          <div class={styles['headline']}>
            <Show when={props.mark} fallback={<Spinner size="md" />}>
              {props.mark}
            </Show>
            <h2 class={styles['title']}>{props.title}</h2>
          </div>
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
