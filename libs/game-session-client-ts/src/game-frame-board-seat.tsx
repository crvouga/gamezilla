import { Trans } from '@lingui/solid/macro';
import { Badge } from '@pkgs/ui-root-client-ts/badge';
import {
  GAME_TABLE_SEAT_AVATAR_SIZE,
  GameTableSeat,
  GameTableSeats,
} from '@pkgs/ui-root-client-ts/game-table-seat';
import { For, type JSX, Show } from 'solid-js';
import { FrameHolderAvatar, FrameHolderName } from './game-frame-people';
import type {
  FramePeople,
  FramePlaySeat,
  FrameTable,
} from './game-frame-view-types';

type SeatProps = {
  readonly table: FrameTable;
  readonly people?: FramePeople | undefined;
  /** The viewer's own seat; `null` while watching. */
  readonly viewerSide: string | null;
};

/** The seat of `side` at the table, or `null` with none. */
function seatAt(table: FrameTable, side: string): FramePlaySeat | null {
  return (
    [table.near, ...table.others].find((seat) => seat?.side === side) ?? null
  );
}

/**
 * The seat's public marks at its place: a stand-in bot playing it, that it
 * has made its secret choice (never what), and the game's own facts.
 */
function BoardSeatTags(props: { readonly seat: FramePlaySeat }): JSX.Element {
  return (
    <>
      <Show when={props.seat.standIn}>
        <Badge
          intent="warning"
          label={<Trans>Stand-in bot</Trans>}
          dataSet={{ testid: `custom-game-${props.seat.side}-stand-in` }}
        />
      </Show>
      <Show when={props.seat.committed}>
        <Badge
          intent="success"
          label={<Trans>Chosen</Trans>}
          dataSet={{ testid: `custom-game-${props.seat.side}-committed` }}
        />
      </Show>
      <For each={props.seat.facts}>
        {(fact) => <Badge intent="neutral" label={fact} />}
      </For>
    </>
  );
}

/**
 * One player at their place at a table the board draws itself: avatar,
 * name, `You` for the viewer's own, and the seat's marks. Whose turn it is
 * the table itself says.
 */
function FrameBoardSeatView(
  props: SeatProps & { readonly side: string }
): JSX.Element {
  return (
    <Show when={seatAt(props.table, props.side)}>
      {(shown) => (
        <GameTableSeat
          name={
            <FrameHolderName
              holder={shown().holder}
              plainName={shown().plainName}
              people={props.people}
            />
          }
          avatar={
            <FrameHolderAvatar
              holder={shown().holder}
              plainName={shown().plainName}
              size={GAME_TABLE_SEAT_AVATAR_SIZE}
              people={props.people}
            />
          }
          tags={
            <>
              <Show when={props.side === props.viewerSide}>
                <Badge intent="info" label={<Trans>You</Trans>} />
              </Show>
              <BoardSeatTags seat={shown()} />
            </>
          }
          onPress={shown().onPress}
        />
      )}
    </Show>
  );
}

/**
 * The board as the game draws it. A board that seats every player itself
 * (`table.shape === 'board'`, `GameFrame.boardSeats`) is lent each of them.
 */
export function FrameBoard(
  props: SeatProps & { readonly board: JSX.Element }
): JSX.Element {
  return (
    <Show when={props.table.shape === 'board'} fallback={props.board}>
      <GameTableSeats
        seat={(side) => ({
          get name() {
            return seatAt(props.table, side)?.plainName ?? null;
          },
          content: (
            <FrameBoardSeatView
              table={props.table}
              people={props.people}
              viewerSide={props.viewerSide}
              side={side}
            />
          ),
        })}
      >
        {props.board}
      </GameTableSeats>
    </Show>
  );
}
