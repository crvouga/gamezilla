import type { AttributeState } from '@gamezilla/attribute';
import {
  andWhereClause,
  type PatchDbQueryWhereClause,
} from '@gamezilla/patch-db/interface';

import { ChessPuzzleAttr } from '../../shared/chess-puzzle-entities';

export const PUZZLE_NEXT_MAX_BAND = 400;

export function hashSeed(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

export function buildPuzzleWhere(
  rating: number,
  halfWindow: number,
  excludeIds: readonly string[]
): PatchDbQueryWhereClause {
  let w = andWhereClause(undefined, {
    type: 'gte',
    attribute: ChessPuzzleAttr.rating.key,
    value: Math.max(0, rating - halfWindow),
  });
  w = andWhereClause(w, {
    type: 'lte',
    attribute: ChessPuzzleAttr.rating.key,
    value: rating + halfWindow,
  });
  if (excludeIds.length > 0) {
    w = andWhereClause(w, {
      type: 'not_in',
      attribute: ChessPuzzleAttr.id.key,
      values: [...excludeIds],
    });
  }
  return w;
}

export function pickPuzzleIdFromPool(args: {
  entities: readonly { entityId: string; attributes: AttributeState }[];
  rating: number;
  preferredBand: number;
  seed: string;
}): string | null {
  const { entities, rating, preferredBand, seed } = args;
  if (entities.length === 0) return null;
  const inBand = entities.filter((e) => {
    const r = ChessPuzzleAttr.rating.from(e.attributes);
    return Math.abs(r - rating) <= preferredBand;
  });
  const pool = inBand.length > 0 ? inBand : entities;
  const idx = hashSeed(seed) % pool.length;
  return pool[idx]?.entityId ?? null;
}
