import {
  formatProposal,
  type ProposedTile,
} from '@libs/word-tiles-shared-ts/word-tiles-action';
import { parseHand } from '@libs/word-tiles-shared-ts/word-tiles-hidden';
import { isOccupied } from '@libs/word-tiles-shared-ts/word-tiles-placement';
import { decodePosition } from '@libs/word-tiles-shared-ts/word-tiles-position';
import { isBlankTile } from '@libs/word-tiles-shared-ts/word-tiles-tiles';

/**
 * The viewer's local candidate move: where their tentative tiles sit, the
 * order of their rack, and which tile or exchange is being chosen. None of
 * it is a move — the candidate becomes one atomic proposal only when it is
 * submitted, and nothing here is ever sent or stored as gameplay. Editing
 * is undoable; the candidate follows the position it was made on, keeping
 * what is still possible when that position or the rack changes.
 */
export type Candidate = {
  readonly base: string;
  readonly order: readonly number[];
  readonly placed: readonly ProposedTile[];
  readonly selected: number | null;
  /** Tiles chosen to exchange, while choosing; `null` otherwise. */
  readonly exchange: readonly number[] | null;
  /** The cell of a placed blank waiting for its letter. */
  readonly blankAt: number | null;
  readonly undo: readonly (readonly ProposedTile[])[];
  readonly redo: readonly (readonly ProposedTile[])[];
};

export function newCandidate(position: string, hand: string | null): Candidate {
  return {
    base: position,
    order: parseHand(hand ?? '') ?? [],
    placed: [],
    selected: null,
    exchange: null,
    blankAt: null,
    undo: [],
    redo: [],
  };
}

function edited(
  candidate: Candidate,
  placed: readonly ProposedTile[]
): Candidate {
  return {
    ...candidate,
    placed,
    undo: [...candidate.undo, candidate.placed],
    redo: [],
  };
}

/** Keep what is still possible after the position or the rack changed. */
export function rebase(
  candidate: Candidate,
  position: string,
  hand: string | null
): Candidate {
  const rack = parseHand(hand ?? '') ?? [];
  const board = decodePosition(position)?.board ?? '';
  const held = new Set(rack);
  const order = [
    ...candidate.order.filter((id) => held.has(id)),
    ...rack.filter((id) => !candidate.order.includes(id)),
  ];
  const placed = candidate.placed.filter(
    (t) => held.has(t.tile) && board !== '' && !isOccupied(board, t.cell)
  );
  const same =
    position === candidate.base && placed.length === candidate.placed.length;
  return {
    ...candidate,
    base: position,
    order,
    placed,
    selected:
      candidate.selected !== null && held.has(candidate.selected)
        ? candidate.selected
        : null,
    exchange: candidate.exchange?.filter((id) => held.has(id)) ?? null,
    blankAt: placed.some((t) => t.cell === candidate.blankAt)
      ? candidate.blankAt
      : null,
    undo: same ? candidate.undo : [],
    redo: same ? candidate.redo : [],
  };
}

export function isPlaced(candidate: Candidate, tile: number): boolean {
  return candidate.placed.some((t) => t.tile === tile);
}

/** A rack tile pressed: chosen for an exchange, selected, or swapped with the selected one. */
export function pressTile(candidate: Candidate, tile: number): Candidate {
  if (candidate.exchange !== null) {
    const chosen = candidate.exchange.includes(tile)
      ? candidate.exchange.filter((id) => id !== tile)
      : [...candidate.exchange, tile];
    return { ...candidate, exchange: chosen };
  }
  if (isPlaced(candidate, tile)) return candidate;
  const selected = candidate.selected;
  if (selected === tile) return { ...candidate, selected: null };
  if (selected === null) return { ...candidate, selected: tile };
  // A second tile while one is selected reorders the rack: the two swap.
  const order = candidate.order.map((id) =>
    id === tile ? selected : id === selected ? tile : id
  );
  return { ...candidate, order, selected: null };
}

/** A board cell pressed: place the selected tile, or recall a tentative one. */
export function pressCell(candidate: Candidate, cell: number): Candidate {
  const board = decodePosition(candidate.base)?.board ?? '';
  const tentative = candidate.placed.find((t) => t.cell === cell);
  if (tentative !== undefined)
    return {
      ...edited(
        candidate,
        candidate.placed.filter((t) => t !== tentative)
      ),
      blankAt: candidate.blankAt === cell ? null : candidate.blankAt,
    };
  const tile = candidate.selected;
  if (tile === null || board === '' || isOccupied(board, cell))
    return candidate;
  const blank = isBlankTile(tile);
  return {
    ...edited(candidate, [
      ...candidate.placed,
      { cell, tile, assigned: blank ? 'A' : null },
    ]),
    selected: null,
    blankAt: blank ? cell : candidate.blankAt,
  };
}

/** Give the blank at `blankAt` the letter `letter`; it may change until submitted. */
export function assignBlank(candidate: Candidate, letter: string): Candidate {
  const at = candidate.blankAt;
  if (at === null || !/^[A-Z]$/.test(letter)) return candidate;
  return {
    ...edited(
      candidate,
      candidate.placed.map((t) =>
        t.cell === at ? { ...t, assigned: letter } : t
      )
    ),
    blankAt: null,
  };
}

export function recallAll(candidate: Candidate): Candidate {
  return candidate.placed.length === 0
    ? { ...candidate, selected: null }
    : { ...edited(candidate, []), selected: null, blankAt: null };
}

export function undoEdit(candidate: Candidate): Candidate {
  const previous = candidate.undo.at(-1);
  if (previous === undefined) return candidate;
  return {
    ...candidate,
    placed: previous,
    undo: candidate.undo.slice(0, -1),
    redo: [...candidate.redo, candidate.placed],
    blankAt: null,
  };
}

export function redoEdit(candidate: Candidate): Candidate {
  const next = candidate.redo.at(-1);
  if (next === undefined) return candidate;
  return {
    ...candidate,
    placed: next,
    redo: candidate.redo.slice(0, -1),
    undo: [...candidate.undo, candidate.placed],
    blankAt: null,
  };
}

/** The rack in a new random order: presentation only, never a move. */
export function shuffleRack(
  candidate: Candidate,
  random: () => number
): Candidate {
  const order = [...candidate.order];
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    const here = order[i];
    const there = order[j];
    if (here === undefined || there === undefined) continue;
    order[i] = there;
    order[j] = here;
  }
  return { ...candidate, order };
}

export function toggleExchange(candidate: Candidate): Candidate {
  return candidate.exchange === null
    ? { ...recallAll(candidate), exchange: [] }
    : { ...candidate, exchange: null };
}

/** The one atomic proposal the candidate submits, or `null` while it is incomplete. */
export function candidateProposal(candidate: Candidate): string | null {
  if (candidate.exchange !== null)
    return candidate.exchange.length === 0
      ? null
      : formatProposal({ kind: 'exchange', tiles: candidate.exchange });
  if (candidate.placed.length === 0 || candidate.blankAt !== null) return null;
  return formatProposal({ kind: 'place', tiles: candidate.placed });
}
