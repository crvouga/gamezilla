import {
  formatAction,
  type PlacedLetter,
  type Proposal,
  type PublicAction,
  parseProposal,
} from './word-tiles-action';
import {
  decodeHidden,
  drawInto,
  encodeHidden,
  exchangeTiles,
  type HiddenState,
  takeFromRack,
} from './word-tiles-hidden';
import type { Lexicon } from './word-tiles-lexicon';
import { evaluatePlacement, unknownWords } from './word-tiles-placement';
import { playAction } from './word-tiles-play';
import { decodePosition, type WordTilesPosition } from './word-tiles-position';
import { RULESET } from './word-tiles-ruleset';
import { rackValue, tileOf } from './word-tiles-tiles';

/**
 * The authority's decision on one proposal by the seat to move: refused
 * with a reason, or the public action it is recorded as and the hidden
 * state after it. All or nothing — a refusal changes no board, rack, bag,
 * score, turn or random state, and nothing is drawn until the proposal is
 * accepted. Pure: the same position, hidden state, lexicon and proposal
 * decide alike.
 */
export type Resolution =
  | { readonly ok: true; readonly action: string; readonly hidden: string }
  | { readonly ok: false; readonly refusal: string };

function refuse(refusal: string): Resolution {
  return { ok: false, refusal };
}

/** The rack value of every seat, in seat order. */
function rackValues(hidden: HiddenState): readonly number[] {
  return hidden.racks.map(rackValue);
}

function owns(hidden: HiddenState, seat: number, tiles: readonly number[]) {
  const rack = new Set(hidden.racks[seat]);
  return tiles.every((tile) => rack.has(tile));
}

function placedLetters(proposal: Extract<Proposal, { kind: 'place' }>) {
  return proposal.tiles.map(
    (t): PlacedLetter => ({
      cell: t.cell,
      letter: t.assigned ?? tileOf(t.tile)!.symbol,
      blank: t.assigned !== null,
    })
  );
}

/**
 * The recorded form of an accepted action: it ends the game exactly when
 * the public rules say so, and then carries every seat's rack value left.
 */
function decided(
  position: WordTilesPosition,
  action: PublicAction,
  hidden: HiddenState
): Resolution {
  for (const end of [null, rackValues(hidden)]) {
    const recorded: PublicAction = { ...action, end };
    if (playAction(position, recorded) !== null)
      return {
        ok: true,
        action: formatAction(recorded),
        hidden: encodeHidden(hidden),
      };
  }
  throw new Error('the authority recorded an action its rules refuse');
}

/** Whether the hidden state agrees with the public counts it backs. */
function agrees(position: WordTilesPosition, hidden: HiddenState): boolean {
  return (
    hidden.bag.length === position.bag &&
    hidden.racks.every((rack, seat) => rack.length === position.racks[seat])
  );
}

function resolvePlacement(
  position: WordTilesPosition,
  proposal: Extract<Proposal, { kind: 'place' }>,
  hidden: HiddenState,
  lexicon: Lexicon
): Resolution {
  const seat = position.turn;
  const tiles = proposal.tiles.map((t) => t.tile);
  if (!owns(hidden, seat, tiles)) return refuse('not your tiles');
  const placed = placedLetters(proposal);
  const evaluation = evaluatePlacement(position.board, placed);
  if (!evaluation.ok) return refuse(evaluation.refusal);
  const unknown = unknownWords(evaluation.score, lexicon.has);
  if (unknown.length > 0)
    return refuse(`not in the word list: ${unknown.join(', ')}`);
  const placedHidden = takeFromRack(hidden, seat, tiles);
  const next = drawInto(
    { ...placedHidden, board: [...placedHidden.board, ...tiles] },
    seat,
    tiles.length
  );
  return decided(
    position,
    {
      kind: 'place',
      placed: [...placed].sort((a, b) => a.cell - b.cell),
      end: null,
    },
    next
  );
}

/**
 * Decide `proposalText` by the seat to move. `lexicon` must be the one the
 * position pins (the caller looks it up by `position.lexicon`); malformed
 * stored state throws, which fails the command without a verdict.
 */
export function resolveProposal(
  positionText: string,
  proposalText: string,
  hiddenText: string,
  lexicon: Lexicon
): Resolution {
  const position = decodePosition(positionText);
  if (position === null) throw new Error('unreadable position');
  if (lexicon.identity.key !== position.lexicon)
    throw new Error('the lexicon is not the one the game pins');
  const hidden = decodeHidden(hiddenText, position.seats);
  if (hidden === null || !agrees(position, hidden))
    throw new Error('unreadable hidden state');
  if (position.ended !== null) return refuse('the game is over');
  const proposal = parseProposal(proposalText);
  if (proposal === null) return refuse('not a move');
  const seat = position.turn;
  if (proposal.kind === 'pass')
    return decided(position, { kind: 'pass', end: null }, hidden);
  if (proposal.kind === 'exchange') {
    if (hidden.bag.length < RULESET.exchangeMinimumBag)
      return refuse('too few tiles in the bag to exchange');
    if (proposal.tiles.length === 0 || !owns(hidden, seat, proposal.tiles))
      return refuse('not your tiles');
    return decided(
      position,
      { kind: 'exchange', count: proposal.tiles.length, end: null },
      exchangeTiles(hidden, seat, proposal.tiles)
    );
  }
  return resolvePlacement(position, proposal, hidden, lexicon);
}
