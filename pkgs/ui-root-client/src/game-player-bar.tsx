import type { ComponentDataSet } from '@pkgs/ui-root-shared/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared/component-id';
import { type JSX, Show } from 'solid-js';
import { Avatar } from './avatar';
import styles from './game-ui.module.css';

/** The one avatar size a seat uses, so both seats of a game line up. */
export const GAME_PLAYER_AVATAR_SIZE = 40;

/**
 * One seat at the table: who sits there, a row of facts about them, and what
 * belongs at the far edge (their clock). Sits flush above or below the board
 * in a `GameBoardStage`, or heads a seat's controls while a game is set up.
 */
export function GamePlayerBar(props: {
  name: JSX.Element;
  /** Defaults to the person placeholder (an open or closed seat). */
  avatar?: JSX.Element;
  /** Facts about the seat, each its own `Badge`: side, rating, readiness. */
  tags?: JSX.Element;
  /** Far edge of the row, typically a `GameClock`. */
  trailing?: JSX.Element;
  /** This seat is to move. */
  active?: boolean;
  /** Controls for the seat, under the row. */
  children?: JSX.Element;
  dataSet?: ComponentDataSet;
}): JSX.Element {
  return (
    <section
      class={styles['player']}
      data-active={props.active === true}
      {...dataAttrs({ component: 'GamePlayerBar', ...props.dataSet })}
    >
      <div class={styles['playerRow']}>
        <span class={styles['playerAvatar']} aria-hidden="true">
          <Show
            when={props.avatar}
            fallback={<Avatar size={GAME_PLAYER_AVATAR_SIZE} />}
          >
            {props.avatar}
          </Show>
        </span>
        <div class={styles['playerIdentity']}>
          <div class="text textLabel line-clamp-1 min-w-0">{props.name}</div>
          <Show when={props.tags}>
            <div class={styles['playerTags']}>{props.tags}</div>
          </Show>
        </div>
        <Show when={props.trailing}>
          <div class={styles['playerTrailing']}>{props.trailing}</div>
        </Show>
      </div>
      <Show when={props.children}>
        <div class="box gap-3">{props.children}</div>
      </Show>
    </section>
  );
}
