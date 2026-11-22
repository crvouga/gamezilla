import { t } from '@lingui/core/macro';
import { formatOrdinal } from '@pkgs/ui-root-client-ts/game-ordinal';
import type {
  FramePlaySeat,
  FrameResult,
  FrameStanding,
  FrameTable,
} from './game-frame-view-types';
import type { SpaceGameHolder, SpaceGameSeatSource } from './space-game-of';

/** Every seat at the table, in seat order: the viewer's own first. */
function seatsOf(table: FrameTable): readonly FramePlaySeat[] {
  return table.near === null ? table.others : [table.near, ...table.others];
}

/** The people-row id of whoever holds `seat`: a person's id, else the seat's. */
function holderId(seat: FramePlaySeat): string {
  return 'person' in seat.holder
    ? seat.holder.person
    : `custom-game-seat-${seat.side}`;
}

/** The test id of the people-row cell of whoever plays `side`. */
export function frameSeatPersonTestId(side: string): string {
  return `custom-game-${side}-person`;
}

/** Who plays each seat, for the people row. */
export function frameHolders(
  table: FrameTable,
  viewerSide: string | null
): readonly SpaceGameHolder[] {
  return seatsOf(table).map((seat) => ({
    side: seat.side,
    person: holderId(seat),
    kind: seat.holder.kind === 'bot' ? 'bot' : 'remote',
    name: seat.plainName,
    you: seat.side === viewerSide,
    testId: frameSeatPersonTestId(seat.side),
  }));
}

/** Two holder lists name the same people in the same seats. */
export function sameHolders(
  a: readonly SpaceGameHolder[],
  b: readonly SpaceGameHolder[]
): boolean {
  return (
    a.length === b.length &&
    a.every(
      (holder, index) =>
        holder.side === b[index]?.side &&
        holder.person === b[index]?.person &&
        holder.kind === b[index]?.kind &&
        holder.name === b[index]?.name &&
        holder.you === b[index]?.you
    )
  );
}

/** A seat's state and marks in words: away or out, a stand-in, a choice. */
function seatWords(seat: FramePlaySeat): readonly string[] {
  return [
    ...(seat.state === null ? [] : [seat.state.label]),
    ...(seat.standIn ? [t`played by a stand-in bot`] : []),
    ...(seat.committed ? [t`choice made`] : []),
    ...(seat.choosing && !seat.committed ? [t`choosing`] : []),
    ...seat.facts,
  ];
}

/**
 * A seat while the game is played: the running clock is its one figure,
 * else the game's own (a score); the rest said in words.
 */
function playSeat(seat: FramePlaySeat): SpaceGameSeatSource {
  const stat =
    seat.stat === null ? [] : [`${seat.stat.label} ${seat.stat.value}`];
  return {
    side: seat.side,
    person: holderId(seat),
    sideLabel: seat.sideLabel,
    look: seat.swatch,
    turn: seat.deciding,
    figure: seat.clock?.value ?? seat.stat?.value ?? null,
    figureTestId:
      seat.clock === null ? undefined : `custom-game-${seat.side}-clock`,
    words: [
      ...(seat.clock === null ? [] : [t`${seat.clock.value} on the clock`]),
      ...stat,
      ...seatWords(seat),
    ],
  };
}

/** A seat once the game is over: its finish, then whether it wants a rematch. */
function overSeat(
  seat: FramePlaySeat,
  standing: FrameStanding,
  locale: string
): SpaceGameSeatSource {
  const place = formatOrdinal(standing.place, locale);
  return {
    side: seat.side,
    person: holderId(seat),
    sideLabel: seat.sideLabel,
    look: seat.swatch,
    turn: false,
    figure: standing.score ?? place,
    words: [
      t`finished ${place}`,
      ...(standing.readiness === null ? [] : [standing.readiness.label]),
    ],
  };
}

/** Each seat as the people row shows it now: in play, or with its finish. */
export function frameSeatSources(
  table: FrameTable,
  result: FrameResult | null,
  locale: string
): readonly SpaceGameSeatSource[] {
  return seatsOf(table).map((seat) => {
    const standing = result?.standings.find((each) => each.id === seat.side);
    return standing === undefined
      ? playSeat(seat)
      : overSeat(seat, standing, locale);
  });
}
