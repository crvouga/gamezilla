import type {
  DealtHandsRules,
  GameBots,
  GameRules,
  GameSide,
  PlayedPosition,
} from '@pkgs/turn-game-shared-ts/game-rules';

/**
 * A test-only four-seat game with dealt hands and one phase of private
 * commitments: each seat is dealt two of the tokens 1 to 8, every seat passes
 * one token to its left in secret, then each plays one token, starting with
 * whoever then holds the 8, clockwise. Every seat that played a token above
 * 4 shares the win (one alone wins alone; all four is a draw).
 */
const SIDES = ['white', 'black', 'red', 'blue'] as const;
type Seat = 0 | 1 | 2 | 3;
type Hidden = { readonly hands: readonly (readonly number[])[] };
type Position =
  | { readonly phase: 'pass' }
  | { readonly phase: 'play'; readonly lead: Seat; readonly plays: readonly number[] }
  | { readonly phase: 'done'; readonly plays: readonly number[] };

function parse(text: string): Position | null {
  if (text === 'token-pass:pass') return { phase: 'pass' };
  const play = /^token-pass:play:([0-3]):([1-8]{0,3})$/.exec(text);
  if (play !== null)
    return {
      phase: 'play',
      lead: Number(play[1]) as Seat,
      plays: [...play[2]!].map(Number),
    };
  const done = /^token-pass:done:([1-8]{4})$/.exec(text);
  return done === null ? null : { phase: 'done', plays: [...done[1]!].map(Number) };
}

function write(position: Position): string {
  if (position.phase === 'pass') return 'token-pass:pass';
  if (position.phase === 'done') return `token-pass:done:${position.plays.join('')}`;
  return `token-pass:play:${position.lead}:${position.plays.join('')}`;
}

const seatToPlay = (position: Position): Seat | null =>
  position.phase === 'play'
    ? (((position.lead + position.plays.length) % 4) as Seat)
    : null;

function step(text: string, action: string): PlayedPosition | null {
  const position = parse(text);
  if (position === null) return null;
  const passed = /^passed:(white|black|red|blue)$/.exec(action);
  if (passed !== null) {
    if (position.phase !== 'pass') return null;
    const lead = SIDES.indexOf(passed[1] as GameSide) as Seat;
    return played({ phase: 'play', lead, plays: [] }, 'passed', SIDES[lead]);
  }
  const token = /^play:([1-8])$/.exec(action);
  const seat = seatToPlay(position);
  if (token === null || seat === null || position.phase !== 'play') return null;
  const value = Number(token[1]);
  if (position.plays.includes(value)) return null;
  const plays = [...position.plays, value];
  if (plays.length < 4)
    return played({ ...position, plays }, String(value), SIDES[((seat + 1) % 4) as Seat]);
  const winners = SIDES.filter(
    (_, at) => plays[(at - position.lead + 4) % 4]! > 4
  );
  const done: PlayedPosition = played({ phase: 'done', plays }, String(value), 'white');
  return {
    ...done,
    winner: winners.length === 0 ? 'draw' : winners,
    reason: 'high tokens',
  };
}

function played(position: Position, label: string, turn: GameSide): PlayedPosition {
  return { position: write(position), history: '', turn, label, winner: null, reason: null };
}

const readHidden = (text: string): Hidden => JSON.parse(text) as Hidden;
const writeHidden = (hidden: Hidden): string => JSON.stringify(hidden);
const holder8 = (hidden: Hidden): GameSide =>
  SIDES[hidden.hands.findIndex((hand) => hand.includes(8))]!;

export const tokenPassHands: DealtHandsRules = {
  deal: (_position, random) => {
    const tokens = [1, 2, 3, 4, 5, 6, 7, 8];
    for (let i = tokens.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [tokens[i], tokens[j]] = [tokens[j]!, tokens[i]!];
    }
    return writeHidden({
      hands: SIDES.map((_, seat) => tokens.slice(seat * 2, seat * 2 + 2).sort()),
    });
  },
  hand: (hidden, side) =>
    readHidden(hidden).hands[SIDES.indexOf(side as (typeof SIDES)[number])]!.join(''),
  resolve: (text, proposal, hiddenText) => {
    const position = parse(text);
    const seat = position === null ? null : seatToPlay(position);
    const hidden = readHidden(hiddenText);
    const value = Number(proposal);
    if (seat === null || !/^[1-8]$/.test(proposal) || !hidden.hands[seat]!.includes(value))
      return { refusal: 'that token is not yours to play' };
    return {
      action: `play:${proposal}`,
      hidden: writeHidden({
        hands: hidden.hands.map((hand, at) =>
          at === seat ? hand.filter((held) => held !== value) : hand
        ),
      }),
    };
  },
  proposals: (text, hand) =>
    seatToPlay(parse(text) ?? { phase: 'pass' }) === null ? [] : [...hand],
  commit: {
    sides: (text) => (parse(text)?.phase === 'pass' ? SIDES : []),
    accept: (text, _side, hand, commitment) =>
      parse(text)?.phase === 'pass' && /^[1-8]$/.test(commitment) && hand.includes(commitment)
        ? commitment
        : null,
    resolve: (_text, commitments, hiddenText) => {
      const hidden = readHidden(hiddenText);
      const given = SIDES.map((side) => Number(commitments[side]));
      const hands = hidden.hands.map((hand, seat) => [
        ...hand.filter((held) => held !== given[seat]),
        given[(seat + 3) % 4]!,
      ].sort());
      const after = { hands };
      return { action: `passed:${holder8(after)}`, hidden: writeHidden(after) };
    },
  },
};

export const tokenPassRules: GameRules = {
  id: 'token-pass',
  sides: SIDES,
  turnOrder: 'rules',
  hands: tokenPassHands,
  recognizes: (text) => parse(text) !== null,
  initial: () => 'token-pass:pass',
  play: (text, action) => step(text, action),
  replay: (actions, ply) => {
    let position = 'token-pass:pass';
    for (const action of actions.slice(0, ply))
      position = step(position, action)?.position ?? position;
    return position;
  },
  legal: (text) => {
    const position = parse(text);
    return position?.phase === 'play'
      ? ['1', '2', '3', '4', '5', '6', '7', '8'].filter((t) => !position.plays.includes(Number(t)))
      : [];
  },
  canWin: (text) => parse(text)?.phase !== 'done',
  moves: () => [],
};

/** Passes its lower token and plays its higher: it sees only its own hand. */
export const tokenPassBots: GameBots = {
  difficulties: [],
  choose: (text, _difficulty, _random, hand) => {
    const position = parse(text);
    if (position === null || hand === null || hand === '') return null;
    return position.phase === 'pass' ? hand[0]! : hand.at(-1)!;
  },
};
