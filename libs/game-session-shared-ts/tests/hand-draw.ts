import type {
  DealtHandsRules,
  GameBots,
  GameRules,
  GameSide,
} from '@pkgs/turn-game-shared-ts/game-rules';

/**
 * A test-only game with dealt hands: each side is dealt one card of six,
 * keeps it or swaps it for the next card of the hidden pile, twice; the
 * higher card wins. Positions say only how many turns were taken and the
 * result; the pile and the cards are the authority's hidden state.
 */
type Hidden = {
  readonly pile: readonly number[];
  readonly white: number;
  readonly black: number;
};
const LAST_PLY = 4;

function parse(position: string): { ply: number; end: string | null } | null {
  const match = /^hand-draw:([0-4])(?::(white|black|draw))?$/.exec(position);
  if (match === null) return null;
  const ply = Number(match[1]);
  const end = match[2] ?? null;
  return (end === null) === ply < LAST_PLY ? { ply, end } : null;
}

function sideAt(ply: number): GameSide {
  return ply % 2 === 0 ? 'white' : 'black';
}

function winnerOf(white: number, black: number): string {
  return white === black ? 'draw' : white > black ? 'white' : 'black';
}

function playAction(position: string, action: string) {
  const at = parse(position);
  const match = /^(keep|swap)(?::end:([1-6]),([1-6]))?$/.exec(action);
  if (at === null || at.end !== null || match === null) return null;
  const ply = at.ply + 1;
  const ends = match[2] !== undefined;
  if (ends !== (ply === LAST_PLY)) return null;
  const end = ends ? winnerOf(Number(match[2]), Number(match[3])) : null;
  return {
    position: end === null ? `hand-draw:${ply}` : `hand-draw:${ply}:${end}`,
    end,
    label: match[1]!,
  };
}

export const handDrawHands: DealtHandsRules = {
  deal: (_position, random) => {
    const pile = [1, 2, 3, 4, 5, 6];
    for (let i = pile.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [pile[i], pile[j]] = [pile[j]!, pile[i]!];
    }
    return JSON.stringify({
      pile: pile.slice(2),
      white: pile[0],
      black: pile[1],
    });
  },
  hand: (hidden, side) =>
    String((JSON.parse(hidden) as Hidden)[side as 'white' | 'black']),
  resolve: (position, proposal, hiddenText) => {
    const at = parse(position);
    if (at === null || at.end !== null) return { refusal: 'the game is over' };
    if (proposal !== 'keep' && proposal !== 'swap')
      return { refusal: 'not a move' };
    const hidden = JSON.parse(hiddenText) as Hidden;
    const side = sideAt(at.ply) as 'white' | 'black';
    const next: Hidden =
      proposal === 'keep'
        ? hidden
        : {
            ...hidden,
            pile: [...hidden.pile.slice(1), hidden[side]],
            [side]: hidden.pile[0]!,
          };
    const end =
      at.ply + 1 === LAST_PLY ? `:end:${next.white},${next.black}` : '';
    return { action: `${proposal}${end}`, hidden: JSON.stringify(next) };
  },
  proposals: (position) => handDrawRules.legal(position),
};

export const handDrawRules: GameRules = {
  id: 'hand-draw',
  hands: handDrawHands,
  recognizes: (position) => parse(position) !== null,
  initial: () => 'hand-draw:0',
  play: (position, action) => {
    const played = playAction(position, action);
    const at = parse(position);
    if (played === null || at === null) return null;
    return {
      position: played.position,
      history: '',
      turn: sideAt(at.ply + 1),
      label: played.label,
      winner: played.end as GameSide | 'draw' | null,
      reason:
        played.end === null || played.end === 'draw' ? null : 'higher card',
    };
  },
  replay: (actions, ply) => {
    let position = 'hand-draw:0';
    for (const action of actions.slice(0, ply))
      position = playAction(position, action)?.position ?? position;
    return position;
  },
  legal: (position) => (parse(position)?.end === null ? ['keep', 'swap'] : []),
  canWin: () => true,
  moves: (_position, _history, actions) => {
    let before = 'hand-draw:0';
    return actions.map((action) => {
      const after = playAction(before, action)?.position ?? before;
      const move = { label: action.split(':')[0]!, before, after };
      before = after;
      return move;
    });
  },
};

/** Keeps a high card, swaps a low one: it sees only its own hand. */
export const handDrawBots: GameBots = {
  difficulties: [],
  choose: (position, _difficulty, _random, hand) =>
    parse(position)?.end !== null ? null : Number(hand) >= 4 ? 'keep' : 'swap',
};
