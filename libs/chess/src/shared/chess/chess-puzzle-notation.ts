/**
 * §7 move-list notation. SAN letters are the default everywhere; figurine
 * algebraic notation swaps the piece letter for its glyph, which is what
 * readers of non-English chess literature expect and what makes the move list
 * legible at a glance on a phone.
 *
 * Only the rendered label changes — {@link PuzzleHistoryPly.san} stays plain
 * SAN so accessible names, logs and assertions keep reading as letters.
 */

export const CHESS_MOVE_NOTATIONS = ['san', 'figurine'] as const;

export type ChessMoveNotation = (typeof CHESS_MOVE_NOTATIONS)[number];

export const DEFAULT_CHESS_MOVE_NOTATION: ChessMoveNotation = 'san';

export function isChessMoveNotation(
  value: unknown
): value is ChessMoveNotation {
  return value === 'san' || value === 'figurine';
}

/**
 * Figurine algebraic notation uses one glyph set for both colours (the
 * "white" pieces), exactly as printed chess notation does.
 */
const PIECE_GLYPH: Readonly<Record<string, string>> = {
  K: '♔',
  Q: '♕',
  R: '♖',
  B: '♗',
  N: '♘',
};

function glyphOf(letter: string | undefined): string | null {
  if (letter === undefined) return null;
  return PIECE_GLYPH[letter] ?? null;
}

/** Replace `=Q` style promotion suffixes with the promoted piece's glyph. */
function figurinePromotion(san: string): string {
  return san.replace(/=([KQRBN])/g, (match, letter: string) => {
    const glyph = glyphOf(letter);
    return glyph === null ? match : `=${glyph}`;
  });
}

/**
 * Render one SAN string under `notation`. Castling (`O-O` / `O-O-O`) and pawn
 * moves have no piece letter and are returned unchanged.
 */
export function formatSanNotation(
  san: string,
  notation: ChessMoveNotation
): string {
  if (notation === 'san') return san;
  if (san.length === 0) return san;
  if (san.startsWith('O-O')) return san;
  const lead = glyphOf(san[0]);
  const body = lead === null ? san : `${lead}${san.slice(1)}`;
  return figurinePromotion(body);
}
