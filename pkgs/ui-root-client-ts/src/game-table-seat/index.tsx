/** @jsxImportSource solid-js */

import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import { createContext, type JSX, Show, useContext } from 'solid-js';
import { Avatar } from '../avatar/index';
import { type GameSeatLook, GameSeatSwatch } from '../game-seat-swatch/index';
import { createScreenSlot } from '../screen-slot';
import styles from './game-table-seat.module.css';

/** The avatar size of a seat at a card table. */
export const GAME_TABLE_SEAT_AVATAR_SIZE = 32;

export type GameTableSeatProps = {
  /** Who sits there; a narrow seat sets a long name smaller, on up to two lines. */
  name: JSX.Element;
  /** Their `Avatar` (32px). Defaults to the person placeholder. */
  avatar?: JSX.Element;
  swatch?: GameSeatLook | undefined;
  /** Short facts about the player, each its own `Badge` (`You`, `West`). */
  tags?: JSX.Element;
  /** Makes the seat a button (open the player). */
  onPress?: (() => void) | undefined;
  /**
   * Rendered as `data-testid` on a wrapper around the seat, for a reader
   * that finds a seat by where it sits (the viewer's own).
   */
  placeTestId?: string | undefined;
  /** DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet | undefined;
};

function SeatFace(props: GameTableSeatProps): JSX.Element {
  const tags = createScreenSlot(() => props.tags);
  return (
    <>
      <span class={styles['avatar']} aria-hidden="true">
        <Show
          when={props.avatar}
          fallback={<Avatar size={GAME_TABLE_SEAT_AVATAR_SIZE} />}
        >
          {props.avatar}
        </Show>
      </span>
      <span class={styles['text']}>
        <span class={`text textLabel ${styles['name']}`}>{props.name}</span>
        <span class={styles['tags']}>
          <Show when={props.swatch}>
            {(look) => <GameSeatSwatch look={look()} />}
          </Show>
          {tags.content()}
        </span>
      </span>
    </>
  );
}

/**
 * `GameTableSeat` -- the person in a seat at a card table: their avatar,
 * their name and a line of short tags (their seat's swatch, `You`, the
 * seat's name), with no frame of its own, so the table's seat plate around
 * it is the one box. It lays itself out by the room it is given: avatar
 * beside the words in a wide seat (above and below the table), avatar over
 * the words in a narrow one (beside it), so a name is never squeezed.
 *
 * A host that knows the people lends seats to a board that draws the table
 * itself through `GameTableSeats`; the board places each with
 * `useGameTableSeat`.
 *
 * @example
 * ```tsx
 * <GameTableSeat name="jordan" swatch={{ color: 'player2' }}
 *   tags={<Badge intent="neutral" label="West" />} />
 * ```
 */
export function GameTableSeat(props: GameTableSeatProps): JSX.Element {
  const seat = (): JSX.Element => (
    <div
      class={styles['root']}
      {...dataAttrs({ component: 'GameTableSeat', ...props.dataSet })}
    >
      <Show
        when={props.onPress}
        fallback={
          <div class={styles['face']}>
            <SeatFace {...props} />
          </div>
        }
      >
        {(press) => (
          <button
            type="button"
            class={`clickable ${styles['face']}`}
            onClick={() => press()()}
          >
            <SeatFace {...props} />
          </button>
        )}
      </Show>
    </div>
  );
  return (
    <Show when={props.placeTestId} fallback={seat()}>
      {(place) => (
        <div class={styles['place']} data-testid={place()}>
          {seat()}
        </div>
      )}
    </Show>
  );
}

type SeatLender = (side: string) => JSX.Element;

const GameTableSeatsContext = createContext<SeatLender | undefined>();

/**
 * Lends the board inside it the person in each seat, by the seat's side,
 * for a board that seats every player around its own table.
 */
export function GameTableSeats(props: {
  seat: SeatLender;
  children: JSX.Element;
}): JSX.Element {
  const lend: SeatLender = (side) => props.seat(side);
  return (
    <GameTableSeatsContext.Provider value={lend}>
      {props.children}
    </GameTableSeatsContext.Provider>
  );
}

/** The person in each seat, when a host lends them; `undefined` otherwise. */
export function useGameTableSeat(): SeatLender | undefined {
  return useContext(GameTableSeatsContext);
}
