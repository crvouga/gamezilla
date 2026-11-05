import type { CustomGameInput } from '@libs/game-session-shared-ts/custom-game-choice';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/solid/macro';
import { Badge } from '@pkgs/ui-root-client-ts/badge';
import { GameActionButton } from '@pkgs/ui-root-client-ts/game-action-button';
import { GameClock } from '@pkgs/ui-root-client-ts/game-clock';
import {
  GAME_PLAYER_AVATAR_SIZE,
  GamePlayerBar,
} from '@pkgs/ui-root-client-ts/game-player-bar';
import type { GameSeatStat } from '@pkgs/ui-root-client-ts/game-player-parts';
import {
  GAME_PLAYER_CHIP_AVATAR_SIZE,
  GamePlayerChip,
  GamePlayerRail,
} from '@pkgs/ui-root-client-ts/game-player-rail';
import {
  GAME_TABLE_SEAT_AVATAR_SIZE,
  GameTableSeat,
} from '@pkgs/ui-root-client-ts/game-table-seat';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { Text } from '@pkgs/ui-root-client-ts/text';
import { For, Index, type JSX, Match, Show, Switch } from 'solid-js';
import { FrameHolderAvatar, FrameHolderName } from './game-frame-people';
import type {
  FrameClock,
  FramePeople,
  FramePlaySeat,
  FrameSeat,
  FrameTable,
} from './game-frame-view-types';

type Choose = (input: CustomGameInput) => Promise<void>;

/** One side's clock. An untimed game has none: its status line says so. */
export function FrameSeatClock(props: {
  readonly seat: FrameSeat;
  readonly clock: FrameClock;
}): JSX.Element {
  return (
    <GameClock
      active={props.clock.active}
      label={props.seat.sideLabel}
      value={props.clock.value}
      dataSet={{ testid: `custom-game-${props.seat.side}-clock` }}
      ariaLabel={props.seat.sideLabel}
    />
  );
}

/**
 * The seat's public facts as tags: a stand-in bot playing it, whether it has
 * made its secret choice (never what), and the game's own facts.
 */
function PlaySeatTags(props: { readonly seat: FramePlaySeat }): JSX.Element {
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
      <Show when={props.seat.choosing}>
        <Badge intent="neutral" label={<Trans>Choosing</Trans>} />
      </Show>
      <For each={props.seat.facts}>
        {(fact) => <Badge intent="neutral" label={fact} />}
      </For>
    </>
  );
}

type SeatProps = {
  readonly seat: FramePlaySeat;
  /** The person's own seat, in a list of every player: tagged `You`. */
  readonly own?: boolean | undefined;
  /** The seat's figure on one quiet line, in a list beside an arena. */
  readonly quietStat?: boolean | undefined;
  readonly people?: FramePeople | undefined;
  readonly onChoose: Choose;
  /** The viewer's own seat; `null` while watching. */
  readonly viewerSide?: string | null | undefined;
};

/** The seat is to move (not making a secret choice, which its tag says). */
export function seatShowsTurn(seat: FramePlaySeat | null | undefined): boolean {
  return seat !== null && seat !== undefined && seat.deciding && !seat.choosing;
}

/** The words inside the seat to move: the viewer's own, or someone else's. */
function SeatTurnLabel(props: {
  readonly seat: FramePlaySeat;
  readonly viewerSide?: string | null | undefined;
}): JSX.Element {
  return (
    <Show
      when={props.seat.side === props.viewerSide}
      fallback={<Trans>To move</Trans>}
    >
      <Trans>Your move</Trans>
    </Show>
  );
}

/**
 * One seat as a full strip: who holds it, its look (named by its side), its
 * facts, its figure and its clock. The seat nearest the person, and the one opponent
 * across a two-seat board.
 */
export function FrameSeatStripView(props: SeatProps): JSX.Element {
  return (
    <GamePlayerBar
      dataSet={{ testid: `custom-game-${props.seat.side}` }}
      name={
        <Text
          variant="inherit"
          testId={`custom-game-${props.seat.side}-person`}
        >
          <FrameHolderName
            holder={props.seat.holder}
            plainName={props.seat.plainName}
            people={props.people}
          />
        </Text>
      }
      avatar={
        <FrameHolderAvatar
          holder={props.seat.holder}
          plainName={props.seat.plainName}
          size={GAME_PLAYER_AVATAR_SIZE}
          people={props.people}
        />
      }
      swatch={props.seat.swatch}
      swatchLabel={props.seat.sideLabel}
      tags={
        <>
          <Show when={props.own === true}>
            <Badge intent="info" label={<Trans>You</Trans>} />
          </Show>
          <PlaySeatTags seat={props.seat} />
        </>
      }
      // In the players' card beside an arena every strip is one line: the
      // person's own `You` sits after their name, not on a row of its own.
      tagsPlacement={props.quietStat === true ? 'inline' : 'below'}
      stat={props.seat.stat}
      statStyle={props.quietStat === true ? 'inline' : 'figure'}
      state={props.seat.state}
      trailing={
        props.seat.clock === null ? undefined : (
          <FrameSeatClock seat={props.seat} clock={props.seat.clock} />
        )
      }
      active={props.seat.deciding}
      turnLabel={
        <Show when={seatShowsTurn(props.seat)}>
          <SeatTurnLabel seat={props.seat} viewerSide={props.viewerSide} />
        </Show>
      }
      onPress={props.seat.onPress}
    >
      <Show when={props.seat.reclaim}>
        <GameActionButton
          title={<Trans>Take back my side</Trans>}
          variant="solid"
          dataSet={{ testid: 'custom-game-reclaim' }}
          operation={() => props.onChoose({ operation: 'reclaim' })}
        />
      </Show>
    </GamePlayerBar>
  );
}

/** The seat's figure on a chip: the game's own, else its running clock. */
function chipStat(seat: FramePlaySeat): GameSeatStat | null {
  if (seat.stat !== null) return seat.stat;
  return seat.clock === null
    ? null
    : { label: t`Time`, value: seat.clock.value };
}

/**
 * One seat at a table of three or more, as a compact chip in the rail. The
 * viewer's own (`own`) says "You" and marks its place as the seat nearest
 * them.
 */
export function FrameSeatChipView(
  props: Omit<SeatProps, 'onChoose'> & { readonly own?: boolean | undefined }
): JSX.Element {
  return (
    <GamePlayerChip
      dataSet={{ testid: `custom-game-${props.seat.side}` }}
      placeTestId={props.own === true ? 'custom-game-seat-near' : undefined}
      name={props.seat.plainName}
      avatar={
        <FrameHolderAvatar
          holder={props.seat.holder}
          plainName={props.seat.plainName}
          size={GAME_PLAYER_CHIP_AVATAR_SIZE}
          people={props.people}
        />
      }
      swatch={props.seat.swatch}
      tags={
        <>
          <Show when={props.own === true}>
            <Badge intent="info" label={<Trans>You</Trans>} />
          </Show>
          <PlaySeatTags seat={props.seat} />
        </>
      }
      stat={chipStat(props.seat)}
      state={props.seat.state}
      active={props.seat.deciding}
      onPress={props.seat.onPress}
    />
  );
}

type TableProps = {
  readonly table: FrameTable;
  readonly people?: FramePeople | undefined;
  readonly onChoose: Choose;
  /** The viewer's own seat; `null` while watching. */
  readonly viewerSide?: string | null | undefined;
  /**
   * A phone: at a table of three or more the person's own seat leads the
   * rail of chips above the board, so they always see themselves beside
   * everyone else without scrolling past the board.
   */
  readonly compact?: boolean | undefined;
};

/**
 * At a table of three or more on a phone, the person's own seat is a chip
 * leading the rail above the board, unless it needs its full strip (to
 * take the side back).
 */
function nearInRail(props: TableProps): FramePlaySeat | null {
  const near = props.table.near;
  return props.compact === true &&
    props.table.shape === 'rail' &&
    near !== null &&
    !near.reclaim
    ? near
    : null;
}

/**
 * Whether a full seat strip says whose move it is, so the turn line can be
 * left to a listener: the near seat, or the one opponent across the board.
 */
export function tableShowsTurn(
  table: FrameTable,
  compact?: boolean | undefined
): boolean {
  // A board that seats its players says the turn by its table and the
  // turn line, never a strip.
  if (table.shape === 'board') return false;
  // A chip in the rail says nothing of the turn: the turn line does.
  const nearStrip =
    nearInRail({ table, compact, onChoose: async () => undefined }) === null;
  return (
    (nearStrip && seatShowsTurn(table.near)) ||
    (table.shape === 'strip' && seatShowsTurn(table.others[0]))
  );
}

/**
 * The other seats, above the board: the one opponent's full strip, or a
 * rail of chips at a bigger table; nothing at a solo table.
 */
export function FrameOthersView(props: TableProps): JSX.Element {
  return (
    <Switch>
      <Match when={props.table.shape === 'strip' && props.table.others[0]}>
        {(seat) => (
          <FrameSeatStripView
            seat={seat()}
            people={props.people}
            onChoose={props.onChoose}
            viewerSide={props.viewerSide}
          />
        )}
      </Match>
      <Match when={props.table.shape === 'rail'}>
        <GamePlayerRail
          aria-label={
            nearInRail(props) === null ? t`Other players` : t`Players`
          }
        >
          <Show when={nearInRail(props)}>
            {(near) => (
              <FrameSeatChipView seat={near()} people={props.people} own />
            )}
          </Show>
          <Index each={props.table.others}>
            {(seat) => (
              <FrameSeatChipView seat={seat()} people={props.people} />
            )}
          </Index>
        </GamePlayerRail>
      </Match>
    </Switch>
  );
}

/**
 * The person's own strip below the board: always, except where a phone's
 * rail leads with it, or a board seats every player itself (there the strip
 * shows only to take the side back).
 */
function nearStrip(props: TableProps): FramePlaySeat | null {
  const near = props.table.near;
  if (props.table.shape === 'board')
    return near?.reclaim === true ? near : null;
  return nearInRail(props) === null ? near : null;
}

/**
 * The seat below the board, nearest the person holding the device (on a
 * phone at a bigger table it leads the rail above instead).
 */
export function FrameNearSeatView(props: TableProps): JSX.Element {
  return (
    <Show when={nearStrip(props)}>
      {(seat) => (
        <StackVertical testId="custom-game-seat-near">
          <FrameSeatStripView
            seat={seat()}
            people={props.people}
            onChoose={props.onChoose}
            viewerSide={props.viewerSide}
          />
        </StackVertical>
      )}
    </Show>
  );
}

/**
 * One player at their place at a table the board draws itself: their
 * avatar and name, `You` for the person's own, a stand-in or a secret
 * choice made, and the game's own facts (the seat's name). Whether the seat
 * still chooses, and whose turn it is, the table itself says.
 */
export function FrameBoardSeatView(
  props: Omit<TableProps, 'onChoose' | 'compact'> & { readonly side: string }
): JSX.Element {
  const seat = (): FramePlaySeat | null =>
    [props.table.near, ...props.table.others].find(
      (each) => each?.side === props.side
    ) ?? null;
  const own = (): boolean =>
    props.viewerSide !== null &&
    props.viewerSide !== undefined &&
    props.side === props.viewerSide;
  return (
    <Show when={seat()}>
      {(shown) => {
        // The own strip below the table, there only to take the side
        // back, carries the seat's marks then.
        const marked = (): boolean => !(own() && shown().reclaim);
        return (
          <GameTableSeat
            dataSet={
              marked() ? { testid: `custom-game-${shown().side}` } : undefined
            }
            placeTestId={
              own() && marked() ? 'custom-game-seat-near' : undefined
            }
            name={
              <Text
                variant="inherit"
                testId={
                  marked() ? `custom-game-${shown().side}-person` : undefined
                }
              >
                <FrameHolderName
                  holder={shown().holder}
                  plainName={shown().plainName}
                  people={props.people}
                />
              </Text>
            }
            avatar={
              <FrameHolderAvatar
                holder={shown().holder}
                plainName={shown().plainName}
                size={GAME_TABLE_SEAT_AVATAR_SIZE}
                people={props.people}
              />
            }
            swatch={shown().swatch}
            tags={
              <>
                <Show when={own()}>
                  <Badge intent="info" label={<Trans>You</Trans>} />
                </Show>
                <PlaySeatTags seat={{ ...shown(), choosing: false }} />
              </>
            }
            onPress={shown().onPress}
          />
        );
      }}
    </Show>
  );
}
