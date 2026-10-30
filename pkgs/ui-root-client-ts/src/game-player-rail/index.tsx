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
import { createScreenSlot } from '../screen-slot';
import { ScrollView } from '../scroll-view/index';

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
 * `GamePlayerRail` + `GamePlayerChip` -- the other players at a table of
 * three or more, as one horizontally scrolling row of compact chips above
 * the board. Each chip shows the player's avatar, swatch, name (truncated),
 * figure, out / reconnecting word and any short facts (`tags`). The rail
 * scrolls inside its own box, so seven long names never widen the page.
 *
 * The active chip (the player to move) is the soft blue (`tintSubtle` fill,
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
    <ScrollView
      horizontal
      flushEdge={false}
      // Reachable by keyboard, so a rail of plain chips can still be scrolled.
      tabIndex={0}
      role="list"
      aria-label={props['aria-label']}
      width="full"
      gap="sm"
      padding="xs"
      dataSet={{ ...props.dataSet, component: 'GamePlayerRail' }}
    >
      {props.children}
    </ScrollView>
  );
}

export type GamePlayerChipProps = {
  /** The player's name; long names are truncated. */
  name: string;
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
  /** DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet | undefined;
};

function ChipFace(props: GamePlayerChipProps): JSX.Element {
  const out = (): boolean => props.state?.kind === 'out';
  const tags = createScreenSlot(() => props.tags);
  return (
    <>
      <span
        class="box shrink-0"
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
      <span class="box flex-1 min-w-0 items-start gap-1">
        <span class="box flex-row items-center gap-1 min-w-0 max-w-full">
          <Show when={props.swatch}>
            {(look) => <GameSeatSwatch look={look()} />}
          </Show>
          <span
            class="text textLabel truncate min-w-0"
            classList={{ 'text-on-primary-soft': props.active === true }}
          >
            {props.name}
          </span>
        </span>
        <Show when={(props.state ?? null) !== null || tags.present()}>
          <span class="box flex-row flex-wrap items-center gap-1 min-w-0">
            <Show when={props.state}>
              {(state) => <GamePlayerStateBadge state={state()} />}
            </Show>
            {tags.content()}
          </span>
        </Show>
      </span>
      <Show when={props.stat}>
        {(stat) => (
          <GameSeatStatValue stat={stat()} active={props.active === true} />
        )}
      </Show>
    </>
  );
}

const CHIP_FRAME =
  'flex-row items-center gap-2 rounded-control border px-2 py-1 min-h-11 max-w-56';

export function GamePlayerChip(props: GamePlayerChipProps): JSX.Element {
  const active = (): boolean => props.active === true;
  const look = () => ({
    'bg-surface border-border': !active(),
    'bg-tint-subtle border-primary-strong': active(),
  });
  return (
    <div
      class="box shrink-0"
      role="listitem"
      aria-current={active() ? 'step' : undefined}
      {...dataAttrs({ component: 'GamePlayerChip', ...props.dataSet })}
      data-active={active() ? 'true' : 'false'}
      data-state={props.state?.kind}
    >
      <Show
        when={props.onPress}
        fallback={
          <div class={`box ${CHIP_FRAME}`} classList={look()}>
            <ChipFace {...props} />
          </div>
        }
      >
        {(press) => (
          <button
            type="button"
            class={`clickable clickableTint ${CHIP_FRAME}`}
            classList={look()}
            onClick={() => press()()}
          >
            <ChipFace {...props} />
          </button>
        )}
      </Show>
    </div>
  );
}
