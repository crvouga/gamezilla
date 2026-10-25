import type {
  DealtHandsRules,
  GameBots,
  GameRecordMetadata,
  GameRules,
  GameSide,
  PlayedPosition,
  RecordedMove,
} from '@pkgs/turn-game-shared-ts/game-rules';
import { formatProposal } from './word-tiles-action';
import { resolveProposal } from './word-tiles-authority';
import { chooseWordTilesProposal } from './word-tiles-bot';
import {
  dealHidden,
  decodeHidden,
  encodeHidden,
  handOf,
  parseHand,
  seedFrom,
} from './word-tiles-hidden';
import {
  DEFAULT_LEXICON_KEY,
  loadLexicon,
  requireLexicon,
} from './word-tiles-lexicon';
import { generateMoves } from './word-tiles-moves';
import {
  type PlayedAction,
  playEncoded,
  winningSeats,
} from './word-tiles-play';
import {
  decodePosition,
  encodePosition,
  newPosition,
  type WordTilesPosition,
} from './word-tiles-position';
import {
  RULESET,
  seatOf,
  seatSides,
  sideOf,
  WORD_TILES_FAMILY,
  WORD_TILES_IDS,
  type WordTilesSeatCount,
} from './word-tiles-ruleset';

/** Why a game ended, as its result names it. */
export const WORD_TILES_REASONS = {
  out: 'rack emptied',
  scoreless: 'six scoreless turns',
} as const;

function decodeOrThrow(position: string): WordTilesPosition {
  const decoded = decodePosition(position);
  if (decoded === null) throw new Error('unreadable Word Tiles position');
  return decoded;
}

function seatsOfHidden(hidden: string): number {
  const raw = JSON.parse(hidden) as { readonly racks?: readonly unknown[] };
  return raw.racks?.length ?? 0;
}

function result(
  position: WordTilesPosition
): Pick<PlayedPosition, 'winner' | 'reason'> {
  if (position.ended === null) return { winner: null, reason: null };
  const leaders = winningSeats(position);
  return {
    winner: leaders.length === 1 ? sideOf(leaders[0]!) : 'draw',
    reason: WORD_TILES_REASONS[position.ended],
  };
}

function played(
  previous: string,
  action: string,
  history: string
): (PlayedPosition & { readonly action: PlayedAction }) | null {
  const next = playEncoded(previous, action);
  if (next === null) return null;
  const position = next.played.position;
  return {
    position: next.position,
    history: history === '' ? action : `${history} ${action}`,
    turn: sideOf(position.turn),
    label: next.played.label,
    action: next.played,
    ...result(position),
  };
}

/** Bounded example proposals for the shared laws and drivers. */
function exampleProposals(position: string, hand: string): readonly string[] {
  const decoded = decodePosition(position);
  const rack = parseHand(hand);
  if (decoded === null || decoded.ended !== null || rack === null) return [];
  const examples = ['pass'];
  if (decoded.bag >= RULESET.exchangeMinimumBag && rack.length > 0)
    examples.push(
      formatProposal({ kind: 'exchange', tiles: rack.slice(0, 1) })
    );
  const search = generateMoves({
    board: decoded.board,
    rack,
    trie: requireLexicon(decoded.lexicon).trie,
    budget: 2_000,
  });
  for (const move of search.moves.slice(0, 4))
    examples.push(formatProposal({ kind: 'place', tiles: move.tiles }));
  return examples;
}

export const wordTilesHands: DealtHandsRules = {
  deal: (position, random) =>
    encodeHidden(dealHidden(decodeOrThrow(position).seats, seedFrom(random))),
  hand: (hidden, side) => {
    const seats = seatsOfHidden(hidden);
    const decoded = decodeHidden(hidden, seats);
    const seat = seatOf(side, seats);
    if (decoded === null || seat === null)
      throw new Error('unreadable hidden state');
    return handOf(decoded, seat);
  },
  resolve: (position, proposal, hidden) => {
    const lexicon = requireLexicon(decodeOrThrow(position).lexicon);
    const resolution = resolveProposal(position, proposal, hidden, lexicon);
    return resolution.ok
      ? { action: resolution.action, hidden: resolution.hidden }
      : { refusal: resolution.refusal };
  },
  proposals: exampleProposals,
};

/** Every word list a stored match may name, loaded once. */
async function prepareWordTiles(): Promise<void> {
  await loadLexicon(DEFAULT_LEXICON_KEY);
}

export function createWordTilesRules(seats: WordTilesSeatCount): GameRules {
  const initial = encodePosition(newPosition(seats, DEFAULT_LEXICON_KEY));
  const replayed = (actions: readonly string[], ply: number) => {
    let position = initial;
    let history = '';
    const moves: RecordedMove[] = [];
    for (const action of actions.slice(0, ply)) {
      const next = played(position, action, history);
      // An accepted history replays in full; anything else is not one.
      if (next === null)
        throw new Error(`Word Tiles cannot replay ${action} at ${position}`);
      moves.push({ label: next.label, before: position, after: next.position });
      position = next.position;
      history = next.history;
    }
    return { position, moves };
  };
  return {
    id: WORD_TILES_IDS[seats],
    family: WORD_TILES_FAMILY,
    sides: seatSides(seats),
    hands: wordTilesHands,
    prepare: prepareWordTiles,
    recognizes: (position) => decodePosition(position)?.seats === seats,
    initial: () => initial,
    play: (position, action, history) => {
      if (decodePosition(position)?.seats !== seats) return null;
      const next = played(position, action, history);
      return next === null
        ? null
        : {
            position: next.position,
            history: next.history,
            turn: next.turn,
            label: next.label,
            winner: next.winner,
            reason: next.reason,
          };
    },
    replay: (actions, ply) => replayed(actions, ply).position,
    // Every hand may pass; placing and exchanging name the hand's own tiles.
    legal: (position) =>
      decodePosition(position)?.ended === null ? ['pass'] : [],
    canWin: (position) => decodePosition(position)?.ended === null,
    moves: (_position, _history, actions) =>
      replayed(actions, actions.length).moves,
  };
}

export const WORD_TILES_RULES = {
  2: createWordTilesRules(2),
  3: createWordTilesRules(3),
  4: createWordTilesRules(4),
} as const;

export const wordTilesBots: GameBots = {
  difficulties: ['easy', 'medium', 'hard'],
  choose: (position, difficulty, random, hand) => {
    const decoded = decodeOrThrow(position);
    if (decoded.ended !== null) return null;
    if (hand === null) throw new Error('a Word Tiles bot needs its own rack');
    return chooseWordTilesProposal({
      position: decoded,
      hand,
      lexicon: requireLexicon(decoded.lexicon),
      difficulty,
      random,
    });
  },
};

/** The game record: its rules and word list, the people, the result and every action. */
export function wordTilesRecord(
  position: string,
  history: string,
  metadata: GameRecordMetadata
): string {
  const decoded = decodeOrThrow(position);
  return JSON.stringify({
    game: WORD_TILES_IDS[decoded.seats],
    ruleset: decoded.ruleset,
    lexicon: decoded.lexicon,
    metadata,
    scores: decoded.scores,
    actions: history === '' ? [] : history.split(' '),
  });
}

/** Seats are told apart by their tile colour. */
export function wordTilesSideLabel(side: GameSide): string {
  return { white: 'Amber', black: 'Teal', red: 'Violet', blue: 'Coral' }[side];
}
