import type { Square } from '@pkgs/chess-board-core-shared/types';

const CASTLE =
  'r3k2r/pppqbppp/2n1bn2/3pp3/3PP3/2N1BN2/PPPQBPPP/R3K2R w KQkq - 0 1';
export const SPECIAL_FRAMES: readonly {
  readonly name: string;
  readonly fen: string;
  readonly from: Square;
  readonly to: Square;
  readonly promotion?: 'q';
}[] = [
  {
    name: 'knight',
    fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    from: 'g1',
    to: 'f3',
  },
  { name: 'kingside castle', fen: CASTLE, from: 'e1', to: 'g1' },
  { name: 'queenside castle', fen: CASTLE, from: 'e1', to: 'c1' },
  {
    name: 'en passant',
    fen: 'rnbqkbnr/ppp1p1pp/8/3pPp2/8/8/PPPP1PPP/RNBQKBNR w KQkq f6 0 3',
    from: 'e5',
    to: 'f6',
  },
  {
    name: 'capture promotion',
    fen: '1n5k/P7/8/8/8/8/8/6K1 w - - 0 1',
    from: 'a7',
    to: 'b8',
    promotion: 'q',
  },
  {
    name: 'promotion',
    fen: '1n5k/P7/8/8/8/8/8/6K1 w - - 0 1',
    from: 'a7',
    to: 'a8',
    promotion: 'q',
  },
];

export type Point = { readonly x: number; readonly y: number };
export type MovingFrame = {
  readonly piece: Point;
  readonly source: Point;
  readonly destination: Point;
};
export type SpecialFrame = {
  readonly moving: readonly MovingFrame[];
  readonly pieces: readonly string[];
  readonly ghosts: readonly {
    readonly code: string;
    readonly opacity: number;
    readonly square: string;
    readonly center: Point;
  }[];
  readonly squares: Readonly<Record<string, Point>>;
};

/** Actual painted bounds; no production coordinate helper participates. */
export function specialFrameRead(
  moves: readonly { from: string; to: string }[]
) {
  return `(() => {
    const board = document.querySelector('[data-testid="browser-board"]');
    const center = el => { const r=el.getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2}; };
    const squares = Object.fromEntries([...board.querySelectorAll('[data-square]')]
      .map(el=>[el.dataset.square,center(el)]));
    return {
      moving: ${JSON.stringify(moves)}.map(m=>({
        source:squares[m.from],destination:squares[m.to],
        piece:center(board.querySelector('[data-piece-square="'+m.to+'"]'))})),
      pieces:[...board.querySelectorAll('[data-piece-square]')]
        .map(el=>el.dataset.piece+'@'+el.dataset.pieceSquare).sort(),
      ghosts:[...board.querySelectorAll('[data-piece]:not([data-piece-square])')]
        .map(el=>({code:el.dataset.piece,opacity:Number(getComputedStyle(el).opacity),square:el.textContent,center:center(el)})),squares
    };
  })()`;
}
