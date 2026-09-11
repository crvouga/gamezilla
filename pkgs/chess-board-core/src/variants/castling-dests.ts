/**
 * Chess960 / standard castling dest helpers: king may move two squares or
 * onto the rook square; callers map both into movable dests.
 */

import type { Square } from '../types';

export type CastleLeg = {
  readonly kingFrom: Square;
  readonly kingTo: Square;
  readonly rookFrom: Square;
  readonly rookTo: Square;
};

/** Destinations the UI should accept for a castle (king two-step + rook square). */
export function castleDropTargets(leg: CastleLeg): readonly Square[] {
  if (leg.kingTo === leg.rookFrom) return [leg.kingTo];
  return [leg.kingTo, leg.rookFrom];
}

/**
 * If `to` is the rook square for this leg, rewrite the king destination to the
 * standard king landing square (`kingTo`).
 */
export function normalizeCastleDrop(
  leg: CastleLeg,
  to: Square
): Square | null {
  if (to === leg.kingTo) return leg.kingTo;
  if (to === leg.rookFrom) return leg.kingTo;
  return null;
}
