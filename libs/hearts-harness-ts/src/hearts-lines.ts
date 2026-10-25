/**
 * Hearts lines as the room's authority plays them: a first deal (the hands
 * the room's documented draws deal, `heartsDealDraws`), the seed of the
 * shuffler that deals every later deal, and the proposals played from the
 * start. A scenario's earlier history is such a line, played fast through
 * the room boundary; this module checks a line is legal and continues one
 * by a fixed, documented policy (each player passes their three last cards
 * in deck order and plays the first card the rules allow), so a later deal
 * is reached the same way every run.
 */

import { parseCards } from '@libs/hearts-shared-ts/hearts-cards';
import {
  decodeHearts,
  HEARTS_SIDES,
  type HeartsPosition,
  sideOfSeat,
} from '@libs/hearts-shared-ts/hearts-position';
import { heartsRules } from '@libs/hearts-shared-ts/hearts-rules';
import { seatToPlay } from '@libs/hearts-shared-ts/hearts-tricks';
import type { GameSide } from '@pkgs/turn-game-shared-ts/game-rules';
import { heartsDealDraws } from './hearts-deal-draws';

/**
 * A pass phase as one proposal of a line: every seat's three cards in seat
 * order, after `commit:` and joined by `|` — how the shared suites write a
 * phase of private commitments.
 */
const COMMITMENTS = 'commit:';

export function committedProposal(passes: readonly string[]): string {
  return `${COMMITMENTS}${passes.join('|')}`;
}

/** Each seat's pass in a pass proposal, or `null` for a card. */
export function splitCommittedProposal(
  proposal: string
): readonly string[] | null {
  return proposal.startsWith(COMMITMENTS)
    ? proposal.slice(COMMITMENTS.length).split('|')
    : null;
}

/** A number source returning `draws` in turn, then repeating the last. */
function scriptedRandom(draws: readonly number[]): () => number {
  let next = 0;
  return () => draws[Math.min(next++, draws.length - 1)] ?? 0;
}

/** Each seat's thirteen cards, in any order. */
export type HeartsHands = Readonly<Record<GameSide, string>>;

/** A first deal, the later deals' seed, and the proposals played from the start. */
export type HeartsLine = {
  readonly hands: HeartsHands;
  /** The four draws that seed the shuffler for later deals (`heartsDealDraws`). */
  readonly seed?: readonly number[];
  readonly history: readonly string[];
};

/** Where a line has reached, as the authority holds it. */
export type HeartsReached = {
  readonly position: HeartsPosition;
  readonly text: string;
  readonly hidden: string;
  readonly history: string;
  readonly actions: readonly string[];
};

const RULES = heartsRules;
const HANDS = RULES.hands!;
const COMMIT = HANDS.commit!;

/** The draws the room's random port returns to deal `line`'s first deal and seed. */
export function heartsLineDraws(line: HeartsLine): readonly number[] {
  return heartsDealDraws(line.hands, line.seed);
}

function decoded(text: string): HeartsPosition {
  const position = decodeHearts(text);
  if (position === null) throw new Error(`${text} is not a Hearts position`);
  return position;
}

/** What the authority records for `proposal`, or why it refuses it. */
function resolved(at: HeartsReached, proposal: string) {
  const commitments = splitCommittedProposal(proposal);
  if (commitments === null) {
    const resolution = HANDS.resolve(at.text, proposal, at.hidden);
    if ('refusal' in resolution)
      throw new Error(`${proposal} refused: ${resolution.refusal}`);
    return resolution;
  }
  const chosen: Partial<Record<GameSide, string>> = {};
  for (const [index, side] of COMMIT.sides(at.text).entries()) {
    const accepted = COMMIT.accept(
      at.text,
      side,
      HANDS.hand(at.hidden, side),
      commitments[index] ?? ''
    );
    if ('refusal' in accepted)
      throw new Error(`${side} cannot pass ${proposal}: ${accepted.refusal}`);
    chosen[side] = accepted.commitment;
  }
  return COMMIT.resolve(at.text, chosen, at.hidden);
}

function step(at: HeartsReached, proposal: string): HeartsReached {
  const resolution = resolved(at, proposal);
  const played = RULES.play(at.text, resolution.action, at.history, [
    ...at.actions,
  ]);
  if (played === null) throw new Error(`${proposal} is not a Hearts move`);
  return {
    position: decoded(played.position),
    text: played.position,
    hidden: resolution.hidden,
    history: played.history,
    actions: [...at.actions, resolution.action],
  };
}

/** The deal `line` starts from, before anything is played. */
function dealt(line: HeartsLine): HeartsReached {
  const text = RULES.initial();
  return {
    position: decoded(text),
    text,
    hidden: HANDS.deal(text, scriptedRandom(heartsLineDraws(line))),
    history: '',
    actions: [],
  };
}

/** Where `line` reaches; throws on the first proposal the authority refuses. */
export function heartsReached(line: HeartsLine): HeartsReached {
  return line.history.reduce(step, dealt(line));
}

/** `side`'s cards once `line` is played. */
export function heartsHandAfter(line: HeartsLine, side: GameSide): string {
  return HANDS.hand(heartsReached(line).hidden, side);
}

/** The policy's proposal at `at`: every side's three last cards, or the first card allowed. */
function policyProposal(at: HeartsReached): string {
  if (at.position.phase === 'pass')
    return committedProposal(
      HEARTS_SIDES.map((side) => {
        const held = parseCards(HANDS.hand(at.hidden, side)) ?? [];
        return held.slice(-3).join('');
      })
    );
  const seat = seatToPlay(at.position);
  if (seat === null) throw new Error('nobody plays once the game is over');
  const hand = HANDS.hand(at.hidden, sideOfSeat(seat));
  const card = HANDS.proposals(at.text, hand)[0];
  if (card === undefined) throw new Error('the side to play has no card');
  return card;
}

/** `line` continued by the documented policy until `done` holds of where it has reached. */
export function heartsLineUntil(
  line: HeartsLine,
  done: (at: HeartsReached) => boolean
): HeartsLine {
  const history = [...line.history];
  let at = heartsReached(line);
  for (let turn = 0; !done(at); turn += 1) {
    if (turn > 2000 || at.position.phase === 'done')
      throw new Error('the line never reaches what it is continued to');
    const proposal = policyProposal(at);
    history.push(proposal);
    at = step(at, proposal);
  }
  return { ...line, history };
}
