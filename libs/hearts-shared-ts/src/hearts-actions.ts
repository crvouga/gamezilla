import { type Card, cardLabel, isCard } from './hearts-cards';
import {
  decodeHearts,
  encodeHearts,
  type HeartsPosition,
  HEARTS_SIDES,
  type HeartsSide,
  INITIAL_HEARTS,
  passDirection,
  type Seat,
  seatOfSide,
  sideOfSeat,
} from './hearts-position';
import {
  dealScores,
  lowestSeats,
  matchOver,
  seatToPlay,
  takenPoints,
} from './hearts-tricks';

/**
 * Public actions, as the authority records them:
 * - `QS` — the side to play plays the queen of spades;
 * - `QS+deal` — the deal's last card, after which a passing deal is dealt;
 * - `QS+deal:red` — the deal's last card, after which a deal without passing
 *   is dealt and red, holding the two of clubs, leads;
 * - `pass:red` — every side's three cards changed hands at once, and red
 *   now holds the two of clubs.
 * Nothing here names a card no reader has seen.
 */
export type HeartsAction =
  | { readonly kind: 'pass'; readonly lead: Seat }
  | {
      readonly kind: 'card';
      readonly card: Card;
      /** For the deal's last card when the match goes on: who leads a hold deal, `null` for a passing deal. */
      readonly next?: { readonly lead: Seat | null };
    };

const SIDE = '(white|black|red|blue)';
const PASS = new RegExp(`^pass:${SIDE}$`);
const CARD = new RegExp(`^([2-9TJQKA][CDSH])(\\+deal(?::${SIDE})?)?$`);

export function parseHeartsAction(text: string): HeartsAction | null {
  const pass = PASS.exec(text);
  if (pass !== null)
    return { kind: 'pass', lead: seatOfSide(pass[1] as HeartsSide) };
  const card = CARD.exec(text);
  if (card === null || !isCard(card[1]!)) return null;
  if (card[2] === undefined) return { kind: 'card', card: card[1] };
  return {
    kind: 'card',
    card: card[1],
    next: {
      lead: card[3] === undefined ? null : seatOfSide(card[3] as HeartsSide),
    },
  };
}

export function writeHeartsAction(action: HeartsAction): string {
  if (action.kind === 'pass') return `pass:${sideOfSeat(action.lead)}`;
  if (action.next === undefined) return action.card;
  return action.next.lead === null
    ? `${action.card}+deal`
    : `${action.card}+deal:${sideOfSeat(action.next.lead)}`;
}

/** What one accepted action leads to, and how the move list names it. */
export type HeartsStep = {
  readonly position: HeartsPosition;
  readonly label: string;
  /** The seats sharing the lowest score once the match is over. */
  readonly winners: readonly Seat[] | null;
};

function passed(position: HeartsPosition, lead: Seat): HeartsStep | null {
  if (position.phase !== 'pass') return null;
  return {
    position: { ...position, phase: 'play', lead },
    label: `Cards passed ${passDirection(position.deal)}`,
    winners: null,
  };
}

/** The position once the deal's last card is played: scored, and the next deal or the end. */
function dealEnded(
  position: HeartsPosition,
  next: { readonly lead: Seat | null } | undefined
): HeartsPosition | null {
  const added = dealScores(takenPoints(position));
  const scores = position.scores.map((score, seat) => score + added[seat]!);
  if (matchOver(scores))
    return next === undefined
      ? { ...position, phase: 'done', scores, lead: null, plays: [], last: added }
      : null;
  const deal = position.deal + 1;
  const hold = passDirection(deal) === 'hold';
  if (next === undefined || (next.lead !== null) !== hold) return null;
  return {
    deal,
    phase: hold ? 'play' : 'pass',
    scores,
    lead: next.lead,
    plays: [],
    last: added,
  };
}

function played(
  position: HeartsPosition,
  action: Extract<HeartsAction, { kind: 'card' }>
): HeartsStep | null {
  if (seatToPlay(position) === null || position.plays.includes(action.card))
    return null;
  if (position.plays.length === 0 && action.card !== '2C') return null;
  const plays = [...position.plays, action.card];
  const label = cardLabel(action.card);
  if (plays.length < 52)
    return action.next === undefined
      ? { position: { ...position, plays }, label, winners: null }
      : null;
  const ended = dealEnded({ ...position, plays }, action.next);
  if (ended === null) return null;
  return {
    position: ended,
    label,
    winners: ended.phase === 'done' ? lowestSeats(ended.scores) : null,
  };
}

/**
 * The position after the public `action`, or `null` when the public position
 * refuses it. Which cards a side holds is checked by the authority, which
 * alone sees them (`resolveHeartsCard`).
 */
export function stepHearts(
  position: HeartsPosition,
  text: string
): HeartsStep | null {
  const action = parseHeartsAction(text);
  if (action === null) return null;
  return action.kind === 'pass'
    ? passed(position, action.lead)
    : played(position, action);
}

/** The positions of `actions` from the start of a match, stopping at the first refused one. */
export function replayHearts(actions: readonly string[]): HeartsStep[] {
  const steps: HeartsStep[] = [];
  let position = INITIAL_HEARTS;
  for (const action of actions) {
    const step = stepHearts(position, action);
    if (step === null) break;
    steps.push(step);
    position = step.position;
  }
  return steps;
}

export { decodeHearts, encodeHearts, HEARTS_SIDES };
