import { createAttrNamespace } from '@gamezilla/lib/attribute';

/** PatchDB entity type for per-user puzzle rating cache (one row per user). */
export const CHESS_PUZZLE_PROFILE_ENTITY_TYPE = 'chess.puzzle.profile';

function readString(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

function readNonEmptyString(v: unknown): string {
  if (typeof v !== 'string') return '';
  const t = v.trim();
  return t.length > 0 ? t : '';
}

function readBoundedInt(args: {
  min: number;
  max: number;
  dflt: number;
}): (v: unknown) => number {
  const { min, max, dflt } = args;
  return (v: unknown): number => {
    let n = dflt;
    if (typeof v === 'number' && Number.isFinite(v)) n = Math.trunc(v);
    if (typeof v === 'string' && v.trim() !== '') {
      const p = Number.parseInt(v, 10);
      if (Number.isFinite(p)) n = p;
    }
    return Math.min(max, Math.max(min, n));
  };
}

const profNs = createAttrNamespace('chess', 'puzzle', 'profile');

/** Denormalized rating cache — recomputed from interactions on terminal events. */
export const ChessPuzzleProfileAttr = {
  ownerId: profNs('owner-id', readNonEmptyString),
  rating: profNs('rating', readBoundedInt({ min: 400, max: 3000, dflt: 1200 })),
  ratingDev: profNs(
    'rating-deviation',
    readBoundedInt({ min: 30, max: 500, dflt: 350 })
  ),
  lastInteractionAt: profNs('last-interaction-at', readString),
} as const;
