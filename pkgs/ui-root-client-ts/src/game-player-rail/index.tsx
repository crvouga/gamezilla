/** @jsxImportSource solid-js */

import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import { type JSX, Show } from 'solid-js';
import { Avatar } from '../avatar/index';
import {
  type GamePlayerState,
  GamePlayerStateBadge,
  type GameSeatStat,
  GameSeatStatInline,
} from '../game-player-parts/index';
import { type GameSeatLook, GameSeatSwatch } from '../game-seat-swatch/index';
import { createScreenSlot } from '../screen-slot';
import styles from './game-player-rail.module.css';

/** The avatar size of a chip: compact, a step below a full strip. */
export const GAME_PLAYER_CHIP_AVATAR_SIZE = 32;

export type GamePlayerRailProps = {
  /** Names the list of players (`Other players`). */
  'aria-label': string;
  /** `GamePlayerChip`s, in seat order. */
  children: JSX.Element;
  /** DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet | undefined;
};

/**
 * `GamePlayerRail` + `GamePlayerChip` -- the players at a table of three or
 * more, as compact chips above the board that wrap onto as many rows as
 * they need (two across a phone; three players on a phone make one row of
 * three equal-height chips, each its name above wrapping facts, the avatar
 * left out, so none is left alone and no fact escapes its chip), so every player is in view
 * at once and none is cut off at the screen's edge. Each chip shows the player's
 * avatar and name on its first line, then their swatch, figure, out /
 * reconnecting word and any short facts (`tags`) on the second, so the
 * name keeps the chip's width. The chips of a row share its height, and a
 * stacked chip's lines start at its top, so avatars, names and figures line
 * up across the row whichever chip carries an extra fact (`You`).
 *
 * The active chip (the player to move) is the soft tint (`tintSubtle` fill,
 * `primaryStrong` border) and `aria-current="step"`. With `onPress` a chip is
 * a button named by its contents.
 *
 * @example
 * ```tsx
 * <GamePlayerRail aria-label="Other players">
 *   <GamePlayerChip name="Erin" swatch={{ color: 'player2' }} active />
 *   <GamePlayerChip name="Sam" state={{ kind: 'out', label: 'Out' }} />
 * </GamePlayerRail>
 * ```
 */
export function GamePlayerRail(props: GamePlayerRailProps): JSX.Element {
  return (
    <div
      class={styles['playerRail']}
      role="list"
      aria-label={props['aria-label']}
      {...dataAttrs({ ...props.dataSet, component: 'GamePlayerRail' })}
    >
      {props.children}
    </div>
  );
}

export type GamePlayerChipProps = {
  /** The player's name; long names are truncated. */
  name: string;
  /**
   * The name as shown, when it reads richer than the plain `name` (a live
   * username, a reader's test id); `name` still titles it.
   */
  nameContent?: JSX.Element;
  /** The player's `Avatar` (32px). Defaults to the person placeholder. */
  avatar?: JSX.Element;
  swatch?: GameSeatLook | undefined;
  stat?: GameSeatStat | null | undefined;
  state?: GamePlayerState | null | undefined;
  /** Short facts about the player, each its own `Badge` (`Passed`, `5 cards`). */
  tags?: JSX.Element;
  /** This player is to move. */
  active?: boolean | undefined;
  /** Makes the chip a button (open the player). */
  onPress?: (() => void) | undefined;
  /**
   * Rendered as `data-testid` on the chip's place in the rail, around the
   * chip, for a reader that finds a seat by where it sits (the viewer's
   * own seat).
   */
  placeTestId?: string | undefined;
  /** DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet | undefined;
};

function ChipFace(props: GamePlayerChipProps): JSX.Element {
  const out = (): boolean => props.state?.kind === 'out';
  const tags = createScreenSlot(() => props.tags);
  return (
    <>
      <span
        class={`box shrink-0 ${styles['chipAvatar']}`}
        classList={{ 'opacity-disabled': out() }}
        aria-hidden="true"
      >
        <Show
          when={props.avatar}
          fallback={<Avatar size={GAME_PLAYER_CHIP_AVATAR_SIZE} />}
        >
          {props.avatar}
        </Show>
      </span>
      <span
        class={`box flex-1 min-w-0 items-start gap-1 ${styles['chipText']}`}
      >
        <span
          class={`text textLabel min-w-0 max-w-full ${styles['chipName']}`}
          classList={{ 'text-on-primary-soft': props.active === true }}
          title={props.name}
        >
          {props.nameContent ?? props.name}
        </span>
        <span
          class={`box flex-row flex-wrap items-center gap-1 min-w-0 ${styles['chipFacts']}`}
        >
          <Show when={props.swatch}>
            {(look) => <GameSeatSwatch look={look()} />}
          </Show>
          <Show when={props.stat}>
            {(stat) => (
              <GameSeatStatInline
                stat={stat()}
                active={props.active === true}
              />
            )}
          </Show>
          <Show when={props.state}>
            {(state) => <GamePlayerStateBadge state={state()} />}
          </Show>
          {tags.content()}
        </span>
      </span>
    </>
  );
}

// Every chip in a row is the row's height, so the rail's chips are one
// even band whichever of them carries an extra fact (`You`).
const CHIP_FRAME =
  'flex-row items-center gap-2 rounded-control border px-2 py-1 min-h-11 w-full min-w-0 flex-1';

export function GamePlayerChip(props: GamePlayerChipProps): JSX.Element {
  const active = (): boolean => props.active === true;
  const look = () => ({
    'bg-surface border-border': !active(),
    'bg-tint-subtle border-primary-strong': active(),
  });
  const chip = (): JSX.Element => (
    <div
      class="box min-w-0 flex-1"
      role={props.placeTestId === undefined ? 'listitem' : undefined}
      aria-current={active() ? 'step' : undefined}
      {...dataAttrs({ component: 'GamePlayerChip', ...props.dataSet })}
      data-active={active() ? 'true' : 'false'}
      data-state={props.state?.kind}
    >
      <Show
        when={props.onPress}
        fallback={
          <div
            class={`box ${CHIP_FRAME} ${styles['chipFrame']}`}
            classList={look()}
          >
            <ChipFace {...props} />
          </div>
        }
      >
        {(press) => (
          <button
            type="button"
            class={`clickable clickableTint ${CHIP_FRAME} ${styles['chipFrame']}`}
            classList={look()}
            onClick={() => press()()}
          >
            <ChipFace {...props} />
          </button>
        )}
      </Show>
    </div>
  );
  return (
    <Show when={props.placeTestId} fallback={chip()}>
      {(place) => (
        <div class="box min-w-0" role="listitem" data-testid={place()}>
          {chip()}
        </div>
      )}
    </Show>
  );
}
