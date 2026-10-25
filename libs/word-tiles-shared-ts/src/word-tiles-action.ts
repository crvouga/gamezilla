import { cellName, parseCell } from './word-tiles-board';
import { RULESET } from './word-tiles-ruleset';
import { isBlankTile, isLetter, tileOf } from './word-tiles-tiles';

/**
 * Two languages of moves. A **proposal** is what a seat submits, naming the
 * physical tiles of its own rack: `pass`, `swap:12.40` (exchange those
 * tiles), `play:h8=12.i8=98E` (tile 12 on h8, the blank 98 as `E` on i8).
 * An **action** is what the authority records and everyone reads, with no
 * tile identity and nothing private: `pass`, `swap:2`, `play:h8C.i8e`
 * (a blank shows as its lowercase letter), each followed by `;end:<values>`
 * when it ends the game (every seat's rack value left, in seat order).
 * One complete placement is one proposal and one action: tiles are never
 * committed one at a time.
 */

export type ProposedTile = {
  readonly cell: number;
  readonly tile: number;
  /** The letter a blank is played as; `null` for any other tile. */
  readonly assigned: string | null;
};

export type Proposal =
  | { readonly kind: 'pass' }
  | { readonly kind: 'exchange'; readonly tiles: readonly number[] }
  | { readonly kind: 'place'; readonly tiles: readonly ProposedTile[] };

export type PlacedLetter = {
  readonly cell: number;
  readonly letter: string;
  readonly blank: boolean;
};

export type PublicAction = (
  | { readonly kind: 'pass' }
  | { readonly kind: 'exchange'; readonly count: number }
  | { readonly kind: 'place'; readonly placed: readonly PlacedLetter[] }
) & {
  /** Every seat's rack value left when this action ended the game. */
  readonly end: readonly number[] | null;
};

const TILE_ID = /^(0|[1-9]\d?)$/;

function parseTileId(text: string): number | null {
  if (!TILE_ID.test(text)) return null;
  const id = Number(text);
  return tileOf(id) === null ? null : id;
}

function parseProposedTile(text: string): ProposedTile | null {
  const match = /^([a-o](?:[1-9]|1[0-5]))=(\d{1,2})([A-Z]?)$/.exec(text);
  if (match === null) return null;
  const cell = parseCell(match[1]!);
  const tile = parseTileId(match[2]!);
  if (cell === null || tile === null) return null;
  const assigned = match[3] === '' ? null : match[3]!;
  // A blank must be assigned a letter; any other tile must not be.
  if (isBlankTile(tile) !== (assigned !== null)) return null;
  return { cell, tile, assigned };
}

function distinct(values: readonly number[]): boolean {
  return new Set(values).size === values.length;
}

/** The proposal `text` writes, or `null` when it is malformed. */
export function parseProposal(text: string): Proposal | null {
  if (text === 'pass') return { kind: 'pass' };
  if (text.startsWith('swap:')) {
    const ids = text.slice(5).split('.').map(parseTileId);
    if (ids.length > RULESET.rackSize || ids.some((id) => id === null))
      return null;
    const tiles = ids as number[];
    return distinct(tiles) ? { kind: 'exchange', tiles } : null;
  }
  if (text.startsWith('play:')) {
    const tiles = text.slice(5).split('.').map(parseProposedTile);
    if (tiles.length > RULESET.rackSize || tiles.some((t) => t === null))
      return null;
    const placed = tiles as ProposedTile[];
    if (!distinct(placed.map((t) => t.cell))) return null;
    if (!distinct(placed.map((t) => t.tile))) return null;
    return { kind: 'place', tiles: placed };
  }
  return null;
}

export function formatProposal(proposal: Proposal): string {
  if (proposal.kind === 'pass') return 'pass';
  if (proposal.kind === 'exchange') return `swap:${proposal.tiles.join('.')}`;
  return `play:${[...proposal.tiles]
    .sort((a, b) => a.cell - b.cell)
    .map((t) => `${cellName(t.cell)}=${t.tile}${t.assigned ?? ''}`)
    .join('.')}`;
}

function parsePlaced(text: string): PlacedLetter | null {
  const match = /^([a-o](?:[1-9]|1[0-5]))([A-Za-z])$/.exec(text);
  if (match === null) return null;
  const cell = parseCell(match[1]!);
  if (cell === null) return null;
  const raw = match[2]!;
  const letter = raw.toUpperCase();
  return isLetter(letter) ? { cell, letter, blank: raw !== letter } : null;
}

function parseEnd(text: string | undefined): readonly number[] | null | false {
  if (text === undefined) return null;
  if (!text.startsWith('end:')) return false;
  const values = text.slice(4).split(',');
  if (!values.every((v) => /^\d{1,3}$/.test(v))) return false;
  return values.map(Number);
}

function parseBody(body: string): PublicAction | null {
  if (body === 'pass') return { kind: 'pass', end: null };
  if (/^swap:[1-7]$/.test(body))
    return { kind: 'exchange', count: Number(body.slice(5)), end: null };
  if (!body.startsWith('play:')) return null;
  const placed = body.slice(5).split('.').map(parsePlaced);
  if (placed.length > RULESET.rackSize || placed.some((p) => p === null))
    return null;
  const letters = placed as PlacedLetter[];
  if (!distinct(letters.map((p) => p.cell))) return null;
  // One spelling per placement: cells in ascending order.
  if (letters.some((p, i) => i > 0 && p.cell < letters[i - 1]!.cell))
    return null;
  return { kind: 'place', placed: letters, end: null };
}

/** The recorded action `text` writes, or `null` when it is malformed. */
export function parseAction(text: string): PublicAction | null {
  const [body, end, ...rest] = text.split(';');
  if (body === undefined || rest.length > 0) return null;
  const parsed = parseBody(body);
  const ending = parseEnd(end);
  if (parsed === null || ending === false) return null;
  return { ...parsed, end: ending };
}

export function formatAction(action: PublicAction): string {
  const end = action.end === null ? '' : `;end:${action.end.join(',')}`;
  if (action.kind === 'pass') return `pass${end}`;
  if (action.kind === 'exchange') return `swap:${action.count}${end}`;
  return `play:${[...action.placed]
    .sort((a, b) => a.cell - b.cell)
    .map(
      (p) => `${cellName(p.cell)}${p.blank ? p.letter.toLowerCase() : p.letter}`
    )
    .join('.')}${end}`;
}
