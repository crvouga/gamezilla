import type { GameSide } from '@pkgs/turn-game-shared-ts/game-rules';
import { type Card, parseCards } from './hearts-cards';

/** The four seats in their fixed clockwise order: play and passing go left, to the next. */
export const HEARTS_SIDES = ['white', 'black', 'red', 'blue'] as const;
export type HeartsSide = (typeof HEARTS_SIDES)[number];
/** A seat's place in the clockwise order, 0 to 3. */
export type Seat = 0 | 1 | 2 | 3;

export type HeartsPhase = 'pass' | 'play' | 'done';
/** A match ends at the end of a deal once a cumulative score reaches this. */
export const MATCH_TARGET = 100;

/**
 * The public position: everything every reader may know and nothing more.
 * Hands are hidden; the position records only the cards played in
 * the current deal, so each seat's hand size and every trick follow from it.
 */
export type HeartsPosition = {
  /** The deal under way, from 1; its number decides the passing direction. */
  readonly deal: number;
  readonly phase: HeartsPhase;
  /** Cumulative scores, in seat order. */
  readonly scores: readonly number[];
  /** The seat holding the two of clubs, who leads the first trick; `null` while passing. */
  readonly lead: Seat | null;
  /** The cards played in this deal, in the order they were played. */
  readonly plays: readonly Card[];
  /** The scores the previous deal added, in seat order; `null` before any deal ends. */
  readonly last: readonly number[] | null;
};

const PREFIX = 'hearts';
const SCORE = /^(0|[1-9][0-9]{0,3})$/;

export function sideOfSeat(seat: Seat): HeartsSide {
  return HEARTS_SIDES[seat];
}

export function seatOfSide(side: GameSide): Seat {
  return HEARTS_SIDES.indexOf(side as HeartsSide) as Seat;
}

/** The seat `steps` places to the left (clockwise) of `seat`. */
export function seatAfter(seat: Seat, steps: number): Seat {
  return ((((seat + steps) % 4) + 4) % 4) as Seat;
}

function parseScores(text: string): number[] | null {
  const parts = text.split(',');
  if (parts.length !== 4 || !parts.every((part) => SCORE.test(part)))
    return null;
  return parts.map(Number);
}

function parseLead(text: string): Seat | null | undefined {
  if (text === '-') return null;
  return /^[0-3]$/.test(text) ? (Number(text) as Seat) : undefined;
}

function consistent(position: HeartsPosition): boolean {
  if (position.deal < 1 || position.deal > 9999) return false;
  if (position.phase === 'play')
    return (
      position.lead !== null &&
      position.plays.length < 52 &&
      (position.plays.length === 0 || position.plays[0] === '2C')
    );
  return position.lead === null && position.plays.length === 0;
}

/** The public position `text` writes, or `null` when it is not one. */
export function decodeHearts(text: string): HeartsPosition | null {
  const parts = text.split(':');
  if (parts.length !== 7 || parts[0] !== PREFIX) return null;
  const [, deal, phase, scores, lead, plays, last] = parts as [
    string,
    string,
    string,
    string,
    string,
    string,
    string,
  ];
  if (!/^[1-9][0-9]*$/.test(deal)) return null;
  if (phase !== 'pass' && phase !== 'play' && phase !== 'done') return null;
  const cumulative = parseScores(scores);
  const leader = parseLead(lead);
  const played = parseCards(plays);
  const previous = last === '-' ? null : parseScores(last);
  if (cumulative === null || leader === undefined || played === null)
    return null;
  if (last !== '-' && previous === null) return null;
  const position: HeartsPosition = {
    deal: Number(deal),
    phase,
    scores: cumulative,
    lead: leader,
    plays: played,
    last: previous,
  };
  return consistent(position) ? position : null;
}

export function encodeHearts(position: HeartsPosition): string {
  return [
    PREFIX,
    String(position.deal),
    position.phase,
    position.scores.join(','),
    position.lead === null ? '-' : String(position.lead),
    position.plays.join(''),
    position.last === null ? '-' : position.last.join(','),
  ].join(':');
}

/** A new match: the first deal, passing to the left. */
export const INITIAL_HEARTS: HeartsPosition = {
  deal: 1,
  phase: 'pass',
  scores: [0, 0, 0, 0],
  lead: null,
  plays: [],
  last: null,
};

export type PassDirection = 'left' | 'right' | 'across' | 'hold';
const DIRECTIONS: readonly PassDirection[] = ['left', 'right', 'across', 'hold'];

/** Left, right, across and hold, repeating by deal. */
export function passDirection(deal: number): PassDirection {
  return DIRECTIONS[(deal - 1) % 4]!;
}

/** The seat `seat` passes to in `deal`; itself on a hold deal. */
export function passTarget(seat: Seat, deal: number): Seat {
  const direction = passDirection(deal);
  return seatAfter(
    seat,
    direction === 'left' ? 1 : direction === 'right' ? 3 : direction === 'across' ? 2 : 0
  );
}
