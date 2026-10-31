/** @jsxImportSource solid-js */

import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import { type JSX, Show } from 'solid-js';
import { Avatar } from '../avatar/index';
import {
  type GamePlayerState,
  GamePlayerStateBadge,
  type GameSeatStat,
  GameSeatStatValue,
} from '../game-player-parts/index';
import { type GameSeatLook, GameSeatSwatch } from '../game-seat-swatch/index';
import styles from '../game-ui.module.css';

/** The one avatar size a seat uses, so both seats of a game line up. */
export const GAME_PLAYER_AVATAR_SIZE = 40;

export type GamePlayerBarProps = {
  name: JSX.Element;
  /**
   * The seat's `Avatar`. Defaults to the person placeholder; an open seat
   * passes `<Avatar kind="emptySeat" />`, a bot `<Avatar kind="bot" />`.
   */
  avatar?: JSX.Element;
  /** The seat's look: its player color and / or mark. */
  swatch?: GameSeatLook | undefined;
  /** Facts about the seat, each its own `Badge`: side, rating, readiness. */
  tags?: JSX.Element;
  /** The seat's figure at the far edge (score, walls). */
  stat?: GameSeatStat | null | undefined;
  /** Out of the round, or reconnecting: shown as a word. */
  state?: GamePlayerState | null | undefined;
  /** Far edge of the row, after the figure: typically a `GameClock`. */
  trailing?: JSX.Element;
  /** This seat is to move. */
  active?: boolean;
  /** Makes the identity a button (open the player). */
  onPress?: (() => void) | undefined;
  /** Controls for the seat, under the row. */
  children?: JSX.Element;
  dataSet?: ComponentDataSet;
};

/** Avatar, swatch and name, and the tags under them. */
function PlayerIdentity(props: GamePlayerBarProps): JSX.Element {
  return (
    <>
      <span
        class={styles['playerAvatar']}
        classList={{ 'opacity-disabled': props.state?.kind === 'out' }}
        aria-hidden="true"
      >
        <Show
          when={props.avatar}
          fallback={<Avatar size={GAME_PLAYER_AVATAR_SIZE} />}
        >
          {props.avatar}
        </Show>
      </span>
      <span class={styles['playerIdentity']}>
        <span class="box flex-row items-center gap-2 min-w-0">
          <Show when={props.swatch}>
            {(look) => <GameSeatSwatch look={look()} />}
          </Show>
          <span
            class="text textLabel line-clamp-1 min-w-0"
            classList={{ 'text-on-primary-soft': props.active === true }}
          >
            {props.name}
          </span>
        </span>
        <Show when={props.tags !== undefined || props.state}>
          <span class={styles['playerTags']}>
            <Show when={props.state}>
              {(state) => <GamePlayerStateBadge state={state()} />}
            </Show>
            {props.tags}
          </span>
        </Show>
      </span>
    </>
  );
}

/**
 * `GamePlayerBar` -- one seat at the table, as a full-width strip: who sits
 * there, how their seat looks, a row of facts about them, their figure and
 * what belongs at the far edge (their clock). Sits above or below the board
 * in a `GameBoardStage`, or heads a seat's controls while a game is set up.
 *
 * - `swatch`: the seat's look (player color and / or mark) before the name.
 * - `stat`: one figure (score, walls) in the `stat` style at the far edge.
 * - `state`: out or reconnecting, as a word in a tag; an out seat is dimmed.
 * - `active`: the seat to move, in the soft tint (`tintSubtle`) and
 *   `aria-current="step"`, never color alone.
 * - `onPress`: the identity becomes a real button (named by the seat's
 *   name and facts), for opening the player.
 *
 * @example
 * ```tsx
 * <GamePlayerBar
 *   name="Erin"
 *   swatch={{ color: 'player2', mark: '◆' }}
 *   stat={{ label: 'Score', value: '12' }}
 *   state={{ kind: 'reconnecting', label: 'Reconnecting' }}
 *   active
 *   onPress={openErin}
 * />
 * ```
 */
export function GamePlayerBar(props: GamePlayerBarProps): JSX.Element {
  const active = (): boolean => props.active === true;
  return (
    <section
      class={`${styles['player']} rounded-card px-3 py-2`}
      classList={{ 'bg-tint-subtle': active() }}
      aria-current={active() ? 'step' : undefined}
      data-active={active()}
      data-state={props.state?.kind}
      {...dataAttrs({ component: 'GamePlayerBar', ...props.dataSet })}
    >
      <div class={styles['playerRow']}>
        <Show
          when={props.onPress}
          fallback={
            <div class={styles['playerPress']}>
              <PlayerIdentity {...props} />
            </div>
          }
        >
          {(press) => (
            <button
              type="button"
              class={`clickable clickableTint rounded-control ${styles['playerPress']}`}
              onClick={() => press()()}
            >
              <PlayerIdentity {...props} />
            </button>
          )}
        </Show>
        <Show when={props.stat}>
          {(stat) => <GameSeatStatValue stat={stat()} active={active()} />}
        </Show>
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
