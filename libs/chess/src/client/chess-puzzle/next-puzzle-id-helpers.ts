import type { AttributeState } from '@pkgs/attribute';
import { AbacEntityAttr } from '@pkgs/patch-db/abac/abac-entity-attr';
import {
  andWhereClause,
  type PatchDbQueryWhereClause,
} from '@pkgs/patch-db/interface';

import { ChessPuzzleAttr } from '../../shared/chess-puzzle-entities';
import {
  CHESS_PUZZLE_INTERACTION_ENTITY_TYPE,
  ChessPuzzleInteractionAttr,
} from '../../shared/chess-puzzle-interaction-entities';

export const PUZZLE_NEXT_MAX_BAND = 400;

export function hashSeed(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/**
 * Builds the puzzle picker's WHERE clause. Uses a server-side subquery as
 * the RHS of `not_in` so the engine excludes every puzzle the current user
 * has interacted with in a single SQL round-trip — no fan-out fetch of the
 * interaction history client-side.
 *
 * `currentPuzzleId`, when supplied, is excluded as a cheap `!=` clause on
 * top of the subquery (covers the in-flight puzzle whose interaction row
 * may not have been indexed yet).
 */
export function buildPuzzleWhere(
  rating: number,
  halfWindow: number | null,
  ownerId: string,
  currentPuzzleId: string | null
): PatchDbQueryWhereClause | undefined {
  let w: PatchDbQueryWhereClause | undefined = undefined;
  if (halfWindow !== null) {
    w = andWhereClause(w, {
      type: 'gte',
      attribute: ChessPuzzleAttr.rating.key,
      value: Math.max(0, rating - halfWindow),
    });
    w = andWhereClause(w, {
      type: 'lte',
      attribute: ChessPuzzleAttr.rating.key,
      value: rating + halfWindow,
    });
  }
  if (ownerId.length > 0) {
    w = andWhereClause(w, {
      type: 'not_in',
      attribute: ChessPuzzleAttr.id.key,
      values: {
        entityType: CHESS_PUZZLE_INTERACTION_ENTITY_TYPE,
        attribute: ChessPuzzleInteractionAttr.puzzleId.key,
        where: {
          type: '=',
          attribute: AbacEntityAttr.owner.key,
          value: ownerId,
        },
      },
    });
  }
  if (currentPuzzleId !== null && currentPuzzleId.length > 0) {
    w = andWhereClause(w, {
      type: '!=',
      attribute: ChessPuzzleAttr.id.key,
      value: currentPuzzleId,
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
