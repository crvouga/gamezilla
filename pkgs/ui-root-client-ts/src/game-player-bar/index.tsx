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
import { createScreenSlot } from '../screen-slot';
import { SeatOptions, SeatOptionsToggle, useSeatOptions } from './seat-options';

/** The one avatar size a seat uses, so both seats of a game line up. */
export const GAME_PLAYER_AVATAR_SIZE = 40;

/** The avatar size of a compact seat row (`density="compact"`). */
export const GAME_PLAYER_COMPACT_AVATAR_SIZE = 32;

export type GamePlayerBarProps = {
  name: JSX.Element;
  /**
   * The seat's `Avatar`. Defaults to the person placeholder; an open seat
   * passes `<Avatar kind="emptySeat" />`, a bot `<Avatar kind="bot" />`.
   */
  avatar?: JSX.Element;
  /** The seat's look: its player color and / or mark. */
  swatch?: GameSeatLook | undefined;
  /**
   * What the swatch stands for (the side's name), when no visible word says
   * it: the swatch is then an image with this name.
   */
  swatchLabel?: string | undefined;
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
  /**
   * Words for the active seat, inside the strip ("Your move", "To move"),
   * so the seat itself is the turn signal. Shown only while `active`.
   */
  turnLabel?: JSX.Element;
  /** Makes the identity a button (open the player). */
  onPress?: (() => void) | undefined;
  /** Controls for the seat, under the row. */
  children?: JSX.Element;
  /**
   * `compact`: one tight row (a 32px avatar, `GAME_PLAYER_COMPACT_AVATAR_SIZE`)
   * for a list of seats being set up, so the seats never push the board
   * down. Defaults to `regular`.
   */
  density?: 'regular' | 'compact' | undefined;
  /**
   * Secondary choices for the seat, behind one trailing pill that shows
   * `optionsLabel` beside a chevron and opens them under the row (native
   * button, `aria-expanded`).
   */
  options?: JSX.Element;
  optionsLabel?: JSX.Element;
  /**
   * Where the options toggle sits: `end` (default) at the row's far edge;
   * `below` on a line of its own under the name, before the seat's own
   * controls, so a phone's row keeps the holder's name whole and the
   * toggle can say what it changes in full ("Change player").
   */
  optionsPlacement?: 'end' | 'below' | undefined;
  /** `data-*` for the toggle (its test id). */
  optionsDataSet?: ComponentDataSet | undefined;
  dataSet?: ComponentDataSet;
};

/** Avatar, swatch and name, and the tags under them. */
function PlayerIdentity(props: GamePlayerBarProps): JSX.Element {
  // Tags that resolve to nothing (every fact hidden) take no row.
  const tags = createScreenSlot(() => props.tags);
  const turnLabel = createScreenSlot(() => props.turnLabel);
  const turn = (): boolean => props.active === true && turnLabel.present();
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
            {(look) => (
              <GameSeatSwatch look={look()} label={props.swatchLabel} />
            )}
          </Show>
          <span
            class="text textLabel line-clamp-1 min-w-0"
            classList={{ 'text-on-primary-soft': props.active === true }}
          >
            {props.name}
          </span>
          {/* The turn on the name's own line: the strip gains no row. */}
          <Show when={turn()}>
            <span
              class={`${styles['playerTurn']} text textLabel rounded-full shrink-0`}
              {...dataAttrs({ component: 'GamePlayerTurn' })}
            >
              {props.turnLabel}
            </span>
          </Show>
        </span>
        <Show
          when={
            tags.present() ||
            (props.state !== undefined && props.state !== null)
          }
        >
          <span class={styles['playerTags']}>
            <Show when={props.state}>
              {(state) => <GamePlayerStateBadge state={state()} />}
            </Show>
            {tags.content()}
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
 * - `active`: the seat to move, in the soft tint (`tintSubtle`) with an
 *   accent edge and `aria-current="step"`, never color alone; `turnLabel`
 *   says it in words on the name's line ("Your move"). Every other seat sits
 *   on the same panel in the surface tone, so the seats around a board match.
 * - `onPress`: the identity becomes a real button (named by the seat's
 *   name and facts), for opening the player.
 * - `density="compact"` + `options`: a seat being set up, as one tight row
 *   whose secondary choices wait behind a single trailing toggle.
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
  // Controls that resolve to nothing (a false `<Show>`) take no room.
  const controls = createScreenSlot(() => props.children);
  const options = useSeatOptions(() => props.options);
  const compact = (): boolean => props.density === 'compact';
  const below = (): boolean =>
    options.present() && props.optionsPlacement === 'below';
  return (
    <section
      class={`${styles['player']} rounded-card py-1`}
      classList={{
        'bg-surface': !active(),
        'bg-tint-subtle': active(),
        'px-3': !compact(),
        'px-1': compact(),
      }}
      data-density={compact() ? 'compact' : 'regular'}
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
        <Show when={options.present() && !below()}>
          <SeatOptionsToggle
            state={options}
            label={props.optionsLabel}
            dataSet={props.optionsDataSet}
          />
        </Show>
      </div>
      <Show
        when={below()}
        fallback={
          <Show when={controls.present()}>
            <div class="box gap-3">{controls.content()}</div>
          </Show>
        }
      >
        {/* Under the name, level with it: the toggle, then the seat's own
            controls, one row of every control the seat has. */}
        <div class={styles['playerBelow']}>
          <SeatOptionsToggle
            state={options}
            label={props.optionsLabel}
            dataSet={props.optionsDataSet}
          />
          <Show when={controls.present()}>
            <div class={styles['playerBelowControls']}>
              {controls.content()}
            </div>
          </Show>
        </div>
      </Show>
      <SeatOptions state={options} />
    </section>
  );
}
