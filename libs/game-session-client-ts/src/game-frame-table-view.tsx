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
      tags={<PlaySeatTags seat={props.seat} />}
      stat={props.seat.stat}
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

/** One of three or more other seats, as a compact chip in the rail. */
export function FrameSeatChipView(
  props: Omit<SeatProps, 'onChoose'>
): JSX.Element {
  return (
    <GamePlayerChip
      dataSet={{ testid: `custom-game-${props.seat.side}` }}
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
      tags={<PlaySeatTags seat={props.seat} />}
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
};

/**
 * Whether a full seat strip says whose move it is, so the turn line can be
 * left to a listener: the near seat, or the one opponent across the board.
 */
export function tableShowsTurn(table: FrameTable): boolean {
  return (
    seatShowsTurn(table.near) ||
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
        <GamePlayerRail aria-label={t`Other players`}>
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

/** The seat below the board, nearest the person holding the device. */
export function FrameNearSeatView(props: TableProps): JSX.Element {
  return (
    <Show when={props.table.near}>
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
