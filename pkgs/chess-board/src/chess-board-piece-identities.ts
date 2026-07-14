import { useRef } from 'react';
import { indexFromSquare, squareFromIndex } from './chess-board-geometry';
import type {
  Move,
  Piece,
  PieceCode,
  PieceType,
  Position,
  Square,
} from './chess-board-types';
import { pieceCode } from './chess-pieces-svg';

export type ChessPieceRow = {
  id: string;
  square: Square;
  code: PieceCode;
  /** True once for newly spawned pieces (promotion / fresh id) */
  fadeIn?: boolean;
};

let nextPieceId = 1;
function allocPieceId(): string {
  return `cp-${nextPieceId++}`;
}

function positionKey(pos: Position): string {
  let s = '';
  for (let i = 0; i < 64; i++) {
    const p = pos[i];
    s += p ? `${p.color}${p.type}` : '-';
  }
  return s;
}

export function positionsEqual(a: Position, b: Position): boolean {
  return positionKey(a) === positionKey(b);
}

function scanRows(pos: Position): ChessPieceRow[] {
  const rows: ChessPieceRow[] = [];
  for (let i = 0; i < 64; i++) {
    const p = pos[i];
    if (!p) continue;
    const code = pieceCode(p.color, p.type);
    if (!code) continue;
    rows.push({
      id: allocPieceId(),
      square: squareFromIndex(i),
      code,
    });
  }
  return rows;
}

type ResolvePieceArgs = {
  sq: Square;
  code: PieceCode;
  active: readonly ChessPieceRow[];
  lastMove: Move;
  mover: ChessPieceRow | undefined;
};

function resolvePieceId(args: ResolvePieceArgs): {
  id: string;
  fadeIn: boolean;
} {
  const { sq, code, active, lastMove, mover } = args;
  if (mover && sq === lastMove.to) {
    return { id: mover.id, fadeIn: false };
  }
  const castle = lastMove.castle;
  if (castle && sq === castle.rookTo) {
    const rook = active.find((r) => r.square === castle.rookFrom);
    return rook
      ? { id: rook.id, fadeIn: false }
      : { id: allocPieceId(), fadeIn: true };
  }
  const same = active.find((r) => r.square === sq && r.code === code);
  return same
    ? { id: same.id, fadeIn: false }
    : { id: allocPieceId(), fadeIn: true };
}

function buildNextRows(
  position: Position,
  active: ChessPieceRow[],
  lastMove: Move
): ChessPieceRow[] {
  const mover = active.find((r) => r.square === lastMove.from);

  const next: ChessPieceRow[] = [];
  for (let i = 0; i < 64; i++) {
    const p = position[i];
    if (!p) continue;
    const sq = squareFromIndex(i);
    const code = pieceCode(p.color, p.type);
    if (!code) continue;
    const { id, fadeIn } = resolvePieceId({
      sq,
      code,
      active,
      lastMove,
      mover,
    });
    next.push({ id, square: sq, code, ...(fadeIn ? { fadeIn: true } : {}) });
  }
  return next;
}

function pieceEq(a: Piece | null, b: Piece | null): boolean {
  if (a === null && b === null) return true;
  if (a === null || b === null) return false;
  return a.color === b.color && a.type === b.type;
}

type CellChange = { i: number; prev: Piece | null; next: Piece | null };

function collectChanges(prev: Position, next: Position): CellChange[] {
  const out: CellChange[] = [];
  for (let i = 0; i < 64; i++) {
    const pi = prev[i] ?? null;
    const ni = next[i] ?? null;
    if (!pieceEq(pi, ni)) out.push({ i, prev: pi, next: ni });
  }
  return out;
}

function sortIndices(a: number[]): number[] {
  return [...a].sort((x, y) => x - y);
}

function setsEqual(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  const sa = sortIndices(a);
  const sb = sortIndices(b);
  for (let k = 0; k < sa.length; k++) if (sa[k] !== sb[k]) return false;
  return true;
}

/** Single-ply diff → Move so piece rows keep stable ids (external FEN / engine). */
export function inferLastMoveFromPositionDiff(
  prev: Position,
  next: Position
): Move | null {
  const ch = collectChanges(prev, next);
  const n = ch.length;
  if (n === 0 || n > 4) return null;

  if (n === 2) return inferTwoSquareChange(ch);
  if (n === 3) return inferEnPassantChange(ch);
  if (n === 4) return inferCastleChange(prev, next, ch);
  return null;
}

function captureFromDestination(
  toPrev: Piece | null,
  moverColor: Piece['color']
): PieceType | undefined {
  if (toPrev !== null && toPrev.color !== moverColor && toPrev.type !== 'k') {
    return toPrev.type;
  }
  return undefined;
}

function promotionFromPawnLand(
  mover: Piece,
  landed: Piece
): Exclude<PieceType, 'p' | 'k'> | null {
  if (mover.type !== 'p' || landed.type === 'p') return null;
  if (landed.type === 'k') return null;
  return landed.type as Exclude<PieceType, 'p' | 'k'>;
}

function inferTwoSquareChange(ch: CellChange[]): Move | null {
  const fromCh = ch.find((c) => c.prev !== null && c.next === null);
  const toCh = ch.find((c) => c.next !== null);
  if (!fromCh || !toCh || fromCh.i === toCh.i) return null;

  const mover = fromCh.prev!;
  const landed = toCh.next!;
  if (mover.color !== landed.color) return null;

  const from = squareFromIndex(fromCh.i);
  const to = squareFromIndex(toCh.i);
  const captured = captureFromDestination(toCh.prev, mover.color);
  const promotion = promotionFromPawnLand(mover, landed) ?? undefined;

  return {
    from,
    to,
    ...(captured ? { captured } : {}),
    ...(promotion ? { promotion } : {}),
  };
}

function isDiagonalAdjacentPawnCapture(
  fromCand: CellChange,
  toCh: CellChange
): boolean {
  const fromFile = fromCand.i % 8;
  const toFile = toCh.i % 8;
  const fromRank = Math.floor(fromCand.i / 8);
  const toRank = Math.floor(toCh.i / 8);
  return Math.abs(fromFile - toFile) === 1 && Math.abs(fromRank - toRank) === 1;
}

type EpTriple = { fromCand: CellChange; toCh: CellChange; victim: CellChange };

function epEmptiesAndLanding(ch: CellChange[]): {
  empties: CellChange[];
  toCh: CellChange;
} | null {
  const empties = ch.filter((c) => c.prev !== null && c.next === null);
  const fills = ch.filter((c) => c.next !== null && c.prev === null);
  if (empties.length !== 2 || fills.length !== 1) return null;
  const toCh = fills[0];
  if (!toCh) return null;
  return { empties, toCh };
}

function epPawnFromAndVictim(
  empties: CellChange[],
  moverColor: Piece['color']
): { fromCand: CellChange; victim: CellChange } | null {
  const fromCand = empties.find((e) => {
    const p = e.prev;
    return p !== null && p.color === moverColor && p.type === 'p';
  });
  if (!fromCand) return null;
  const victim = empties.find((e) => e !== fromCand);
  const vp = victim?.prev;
  if (!victim || !vp || vp.type !== 'p' || vp.color === moverColor) return null;
  return { fromCand, victim };
}

function tryParseEpTriple(ch: CellChange[]): EpTriple | null {
  const head = epEmptiesAndLanding(ch);
  if (!head) return null;
  const { empties, toCh } = head;
  const mover = toCh.next;
  if (!mover || mover.type !== 'p') return null;
  const pair = epPawnFromAndVictim(empties, mover.color);
  if (!pair) return null;
  return { fromCand: pair.fromCand, toCh, victim: pair.victim };
}

function inferEnPassantChange(ch: CellChange[]): Move | null {
  const t = tryParseEpTriple(ch);
  if (!t) return null;
  const { fromCand, toCh, victim } = t;
  if (!isDiagonalAdjacentPawnCapture(fromCand, toCh)) return null;

  const epIdx = Math.floor(fromCand.i / 8) * 8 + (toCh.i % 8);
  if (victim.i !== epIdx) return null;

  return {
    from: squareFromIndex(fromCand.i),
    to: squareFromIndex(toCh.i),
    captured: 'p' as const,
    enPassant: true as const,
  };
}

type CastleSpec = {
  indices: number[];
  kingFrom: Square;
  kingTo: Square;
  rookFrom: Square;
  rookTo: Square;
};

const CASTLE_SPECS: CastleSpec[] = [
  {
    indices: [4, 5, 6, 7],
    kingFrom: 'e1',
    kingTo: 'g1',
    rookFrom: 'h1',
    rookTo: 'f1',
  },
  {
    indices: [0, 2, 3, 4],
    kingFrom: 'e1',
    kingTo: 'c1',
    rookFrom: 'a1',
    rookTo: 'd1',
  },
  {
    indices: [60, 61, 62, 63],
    kingFrom: 'e8',
    kingTo: 'g8',
    rookFrom: 'h8',
    rookTo: 'f8',
  },
  {
    indices: [56, 58, 59, 60],
    kingFrom: 'e8',
    kingTo: 'c8',
    rookFrom: 'a8',
    rookTo: 'd8',
  },
];

function kingEndsOk(pk: Piece | null, nk: Piece | null): pk is Piece {
  return !!(
    pk &&
    nk &&
    pk.type === 'k' &&
    nk.type === 'k' &&
    pk.color === nk.color
  );
}

function rookEndsMatchKing(
  pr: Piece | null,
  nr: Piece | null,
  king: Piece
): boolean {
  return !!(
    pr &&
    nr &&
    pr.type === 'r' &&
    nr.type === 'r' &&
    pr.color === nr.color &&
    pr.color === king.color
  );
}

type CastleIdx = { kf: number; kt: number; rf: number; rt: number };

function castleOriginsDestEmpty(
  prev: Position,
  next: Position,
  ix: CastleIdx
): boolean {
  const { kf, kt, rf, rt } = ix;
  return (
    (prev[kt] ?? null) === null &&
    (next[kf] ?? null) === null &&
    (prev[rt] ?? null) === null &&
    (next[rf] ?? null) === null
  );
}

function tryCastleSpec(
  spec: CastleSpec,
  prev: Position,
  next: Position,
  changeIndices: number[]
): Move | null {
  if (!setsEqual(changeIndices, spec.indices)) return null;

  const ix: CastleIdx = {
    kf: indexFromSquare(spec.kingFrom),
    kt: indexFromSquare(spec.kingTo),
    rf: indexFromSquare(spec.rookFrom),
    rt: indexFromSquare(spec.rookTo),
  };
  const pk = prev[ix.kf] ?? null;
  const nk = next[ix.kt] ?? null;
  if (!kingEndsOk(pk, nk)) return null;
  if (!rookEndsMatchKing(prev[ix.rf] ?? null, next[ix.rt] ?? null, pk))
    return null;
  if (!castleOriginsDestEmpty(prev, next, ix)) return null;

  return {
    from: spec.kingFrom,
    to: spec.kingTo,
    castle: { rookFrom: spec.rookFrom, rookTo: spec.rookTo },
  };
}

function inferCastleChange(
  prev: Position,
  next: Position,
  ch: CellChange[]
): Move | null {
  const idx = ch.map((c) => c.i);
  for (const spec of CASTLE_SPECS) {
    const m = tryCastleSpec(spec, prev, next, idx);
    if (m) return m;
  }
  return null;
}

type PieceRowsCache = {
  position: Position;
  rows: ChessPieceRow[];
};

function nextRowsForPositionChange(
  prev: Position,
  position: Position,
  active: readonly ChessPieceRow[],
  lastMove: Move | null
): ChessPieceRow[] {
  if (!lastMove) {
    const inferred = inferLastMoveFromPositionDiff(prev, position);
    return inferred
      ? buildNextRows(position, [...active], inferred)
      : rematchRows(active, position);
  }
  return buildNextRows(position, [...active], lastMove);
}

function indexPrevRows(prevRows: readonly ChessPieceRow[]): {
  bySquareCode: Map<string, ChessPieceRow>;
  byCode: Map<PieceCode, ChessPieceRow[]>;
} {
  const bySquareCode = new Map<string, ChessPieceRow>();
  const byCode = new Map<PieceCode, ChessPieceRow[]>();
  for (const r of prevRows) {
    bySquareCode.set(`${r.square}:${r.code}`, r);
    const list = byCode.get(r.code) ?? [];
    list.push(r);
    byCode.set(r.code, list);
  }
  return { bySquareCode, byCode };
}

function claimSquareMatches(
  position: Position,
  bySquareCode: Map<string, ChessPieceRow>,
  usedIds: Set<string>
): {
  matched: ChessPieceRow[];
  unmatched: { square: Square; code: PieceCode }[];
} {
  const matched: ChessPieceRow[] = [];
  const unmatched: { square: Square; code: PieceCode }[] = [];
  for (let i = 0; i < 64; i++) {
    const p = position[i];
    if (!p) continue;
    const code = pieceCode(p.color, p.type);
    if (!code) continue;
    const square = squareFromIndex(i);
    const hit = bySquareCode.get(`${square}:${code}`);
    if (hit && !usedIds.has(hit.id)) {
      usedIds.add(hit.id);
      matched.push({ id: hit.id, square, code });
    } else {
      unmatched.push({ square, code });
    }
  }
  return { matched, unmatched };
}

function claimCodeFallback(
  unmatched: readonly { square: Square; code: PieceCode }[],
  byCode: Map<PieceCode, ChessPieceRow[]>,
  usedIds: Set<string>
): ChessPieceRow[] {
  const out: ChessPieceRow[] = [];
  for (const row of unmatched) {
    const hit = byCode.get(row.code)?.find((r) => !usedIds.has(r.id));
    if (hit) {
      usedIds.add(hit.id);
      out.push({ id: hit.id, square: row.square, code: row.code });
    } else {
      out.push({
        id: allocPieceId(),
        square: row.square,
        code: row.code,
        fadeIn: true,
      });
    }
  }
  return out;
}

/**
 * Rematch piece ids across a non-ply position swap (puzzle reset / fen jump)
 * so resting pieces keep React identity and can slide instead of remounting.
 */
export function rematchRows(
  prevRows: readonly ChessPieceRow[],
  position: Position
): ChessPieceRow[] {
  const { bySquareCode, byCode } = indexPrevRows(prevRows);
  const usedIds = new Set<string>();
  const { matched, unmatched } = claimSquareMatches(
    position,
    bySquareCode,
    usedIds
  );
  return [...matched, ...claimCodeFallback(unmatched, byCode, usedIds)];
}

/**
 * Stable piece ids keyed to board position. Computed synchronously so DnD
 * overlay layout (`left`/`top`) updates in the same React commit as the move —
 * lagging behind via `useEffect` left Draggables with stale origins while the
 * library kept drop `tx`/`ty`, so pieces vanished from the landing square.
 */
export function useChessPieceRows(
  position: Position,
  lastMove: Move | null
): { active: ChessPieceRow[] } {
  const cacheRef = useRef<PieceRowsCache | null>(null);
  if (cacheRef.current === null) {
    cacheRef.current = { position, rows: scanRows(position) };
  } else if (!positionsEqual(cacheRef.current.position, position)) {
    cacheRef.current = {
      position,
      rows: nextRowsForPositionChange(
        cacheRef.current.position,
        position,
        cacheRef.current.rows,
        lastMove
      ),
    };
  }
  return { active: cacheRef.current.rows };
}
