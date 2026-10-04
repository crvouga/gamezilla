/** UCI long-algebraic move format: `e2e4`, `e7e8q`. */

export type Promotion = 'q' | 'r' | 'b' | 'n';

export type UciMove = {
  readonly from: string;
  readonly to: string;
  readonly promotion?: Promotion;
};

const UCI_RE = /^([a-h][1-8])([a-h][1-8])([qrbn])?$/;

/** Parses a UCI move (case-insensitive, trimmed); `null` when malformed. */
export function parseUci(uci: string): UciMove | null {
  const match = UCI_RE.exec(uci.trim().toLowerCase());
  if (match === null) return null;
  const [, from, to, promotion] = match as unknown as [
    string,
    string,
    string,
    Promotion | undefined,
  ];
  if (from === to) return null;
  return promotion === undefined ? { from, to } : { from, to, promotion };
}

export function formatUci(move: UciMove): string {
  return move.from + move.to + (move.promotion ?? '');
}

/** Lower-cased UCI tokens of a space-separated move list; blanks dropped. */
export function tokenizeUciLine(moves: string): readonly string[] {
  return moves
    .trim()
    .split(/\s+/)
    .map((s) => s.toLowerCase())
    .filter((s) => s.length > 0);
}
