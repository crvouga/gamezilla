import type {
  CommitmentAcceptance,
  DealtHandsRules,
  GameCommitments,
  GameRules,
  GameSide,
  HandsResolution,
  PlayedPosition,
} from '@pkgs/turn-game-shared-ts/game-rules';
import { plainWinner } from '@pkgs/turn-game-shared-ts/game-rules';
import { replayHearts, stepHearts, writeHeartsAction } from './hearts-actions';
import {
  type Card,
  DECK,
  isCard,
  parseCards,
  writeCards,
} from './hearts-cards';
import {
  dealFrom,
  type HeartsHidden,
  handsOf,
  readHidden,
  shuffleDeck,
  shufflerFrom,
  twoOfClubsSeat,
  writeHidden,
} from './hearts-hidden';
import {
  decodeHearts,
  encodeHearts,
  HEARTS_SIDES,
  type HeartsPosition,
  INITIAL_HEARTS,
  passDirection,
  passTarget,
  type Seat,
  seatOfSide,
  sideOfSeat,
} from './hearts-position';
import {
  cardRefusal,
  dealScores,
  legalCards,
  matchOver,
  seatToPlay,
  takenPoints,
} from './hearts-tricks';

export const HEARTS_ID = 'hearts';
/** The ending reason of a finished match. */
export const HEARTS_REASON = 'lowest score';

/**
 * The first deal, shuffled with the authority's own random (fifty-one
 * draws), then four 32-bit words more: a 128-bit seed for the shuffler kept
 * in the hidden state, which deals every later deal.
 */
export function dealHearts(_position: string, random: () => number): string {
  const hands = handsOf(shuffleDeck(random));
  const words = [0, 1, 2, 3].map(() =>
    Math.min(0xffffffff, Math.floor(random() * 0x100000000))
  );
  return writeHidden({ shuffler: shufflerFrom(words), hands });
}

/** `side`'s cards held now, as its seat sees them. */
export function heartsHand(hidden: string, side: GameSide): string {
  const held = readHidden(hidden)?.hands[seatOfSide(side)] ?? [];
  return writeCards(held);
}

/** Whether `card` ends the deal without ending the match, so the authority deals again. */
function dealsAgain(position: HeartsPosition, card: Card): boolean {
  if (position.plays.length !== 51) return false;
  const finished = { ...position, plays: [...position.plays, card] };
  const added = dealScores(takenPoints(finished));
  return !matchOver(position.scores.map((score, seat) => score + added[seat]!));
}

function withoutCard(
  hidden: HeartsHidden,
  seat: Seat,
  card: Card
): HeartsHidden {
  return {
    ...hidden,
    hands: hidden.hands.map((hand, at) =>
      at === seat ? hand.filter((held) => held !== card) : hand
    ),
  };
}

/** The public action the side to play's card resolves to, with every hand. */
function resolveHeartsCard(
  text: string,
  proposal: string,
  hiddenText: string
): HandsResolution {
  const position = decodeHearts(text);
  const hidden = readHidden(hiddenText);
  const seat = position === null ? null : seatToPlay(position);
  if (position === null || hidden === null || seat === null)
    return { refusal: 'no card is played now' };
  if (!isCard(proposal)) return { refusal: 'not your card' };
  const refusal = cardRefusal(position, seat, hidden.hands[seat]!, proposal);
  if (refusal !== null) return { refusal };
  const after = withoutCard(hidden, seat, proposal);
  if (!dealsAgain(position, proposal))
    return { action: proposal, hidden: writeHidden(after) };
  const dealt = dealFrom(after.shuffler);
  const hold = passDirection(position.deal + 1) === 'hold';
  return {
    action: writeHeartsAction({
      kind: 'card',
      card: proposal,
      next: { lead: hold ? twoOfClubsSeat(dealt) : null },
    }),
    hidden: writeHidden(dealt),
  };
}

/**
 * A few of the passes `held` allows, bounded for the laws and drivers that
 * walk games with them: its cards in threes, lowest first, and its three
 * highest.
 */
function somePasses(held: readonly Card[]): readonly string[] {
  if (held.length < 3) return [];
  const passes = new Set<string>();
  for (let at = 0; at + 3 <= held.length; at += 3)
    passes.add(writeCards(held.slice(at, at + 3)));
  passes.add(writeCards(held.slice(-3)));
  return [...passes];
}

/** Three distinct cards from the passing side's hand, written in deck order. */
function acceptPass(
  text: string,
  _side: GameSide,
  hand: string,
  commitment: string
): CommitmentAcceptance {
  const held = parseCards(hand);
  const cards = parseCards(commitment);
  if (decodeHearts(text)?.phase !== 'pass' || held === null)
    return { refusal: 'no passing now' };
  if (cards === null || cards.length !== 3)
    return { refusal: 'pass three different cards' };
  if (!cards.every((card) => held.includes(card)))
    return { refusal: 'not your card' };
  return { commitment: writeCards(cards) };
}

/** Every side's three cards change hands at once; the two of clubs' new holder leads. */
function resolvePasses(
  text: string,
  commitments: GameCommitments,
  hiddenText: string
): { readonly action: string; readonly hidden: string } {
  const position = decodeHearts(text);
  const hidden = readHidden(hiddenText);
  if (position?.phase !== 'pass' || hidden === null)
    throw new Error('passing needs a Hearts position and its hands');
  const given = HEARTS_SIDES.map((side) => {
    const cards = parseCards(commitments[side] ?? '');
    if (cards === null || cards.length !== 3)
      throw new Error(`${side} has no pass to resolve`);
    return cards;
  });
  const hands = hidden.hands.map((hand, seat) =>
    hand.filter((card) => !given[seat]!.includes(card))
  );
  for (const [seat, cards] of given.entries())
    hands[passTarget(seat as Seat, position.deal)]!.push(...cards);
  const after = {
    ...hidden,
    hands: hands.map((hand) => DECK.filter((card) => hand.includes(card))),
  };
  return {
    action: writeHeartsAction({ kind: 'pass', lead: twoOfClubsSeat(after) }),
    hidden: writeHidden(after),
  };
}

export const heartsHands: DealtHandsRules = {
  deal: dealHearts,
  hand: heartsHand,
  resolve: resolveHeartsCard,
  proposals: (text, hand) => {
    const position = decodeHearts(text);
    const held = parseCards(hand);
    if (position === null || held === null) return [];
    if (position.phase === 'pass') return somePasses(held);
    const seat = seatToPlay(position);
    return seat === null ? [] : legalCards(position, seat, held);
  },
  commit: {
    sides: (text) => (decodeHearts(text)?.phase === 'pass' ? HEARTS_SIDES : []),
    accept: acceptPass,
    resolve: resolvePasses,
  },
};

function playedPosition(
  step: NonNullable<ReturnType<typeof stepHearts>>,
  history: string
): PlayedPosition {
  const seat = seatToPlay(step.position);
  return {
    position: encodeHearts(step.position),
    history,
    turn: seat === null ? 'white' : sideOfSeat(seat),
    label: step.label,
    winner:
      step.winners === null
        ? null
        : plainWinner(step.winners.map(sideOfSeat), HEARTS_SIDES),
    reason: step.winners === null ? null : HEARTS_REASON,
  };
}

/**
 * Hearts' rules over public positions and actions. The authority alone
 * resolves which cards a side holds (`heartsHands`); `play`, `replay`
 * and `moves` see only what everyone sees. The trick's winner leads the next
 * trick, so the rules name each next side (`turnOrder: 'rules'`).
 */
export const heartsRules: GameRules = {
  id: HEARTS_ID,
  sides: HEARTS_SIDES,
  turnOrder: 'rules',
  hands: heartsHands,
  recognizes: (position) => decodeHearts(position) !== null,
  initial: () => encodeHearts(INITIAL_HEARTS),
  play(text, action, history) {
    const position = decodeHearts(text);
    if (position === null || position.phase === 'done') return null;
    const step = stepHearts(position, action);
    if (step === null) return null;
    return playedPosition(
      step,
      history === '' ? action : `${history} ${action}`
    );
  },
  replay: (actions, ply) => {
    const accepted = actions.slice(0, ply);
    const steps = replayHearts(accepted);
    // A stored history the rules refuse is inconsistent, never a shorter game.
    if (steps.length !== accepted.length)
      throw new Error(`hearts: ${accepted[steps.length]} is not a move here`);
    return encodeHearts(steps.at(-1)?.position ?? INITIAL_HEARTS);
  },
  legal: (text) => {
    const position = decodeHearts(text);
    if (position?.phase !== 'play') return [];
    return DECK.filter((card) => !position.plays.includes(card));
  },
  canWin: (text) => decodeHearts(text)?.phase !== 'done',
  moves: (_position, _history, actions) => {
    const steps = replayHearts(actions);
    return steps.map((step, index) => ({
      label: step.label,
      before: encodeHearts(steps[index - 1]?.position ?? INITIAL_HEARTS),
      after: encodeHearts(step.position),
    }));
  },
};
