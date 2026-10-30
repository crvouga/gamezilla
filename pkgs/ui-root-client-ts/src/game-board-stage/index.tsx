import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import { type JSX, Show } from 'solid-js';
import styles from '../game-ui.module.css';
import { createScreenSlot } from '../screen-slot';

/**
 * The play surface and the people around it. The game supplies the
 * interactive surface; the stage keeps it the largest thing on the screen,
 * in reading order: the other players above it (one `GamePlayerBar`, or a
 * `GamePlayerRail` at a bigger table), then the board, then the turn
 * (`GameTurnPill`), then the person's own strip. An empty slot takes no room.
 */
export function GameBoardStage(props: {
  /** The other players, above the board. */
  others?: JSX.Element;
  /** Whose turn it is, between the board and the person's own strip. */
  turn?: JSX.Element;
  /** The person holding the device, below the board. */
  own?: JSX.Element;
  children: JSX.Element;
  dataSet?: ComponentDataSet | undefined;
}): JSX.Element {
  const others = createScreenSlot(() => props.others);
  const turn = createScreenSlot(() => props.turn);
  const own = createScreenSlot(() => props.own);
  return (
    <div
      class={styles['boardStage']}
      {...dataAttrs({ component: 'GameBoardStage', ...props.dataSet })}
    >
      <Show when={others.present()}>{others.content()}</Show>
      <div class={styles['board']}>{props.children}</div>
      <Show when={turn.present()}>{turn.content()}</Show>
      <Show when={own.present()}>{own.content()}</Show>
    </div>
  );
}
