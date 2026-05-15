import { useMyId } from '@gamezilla/auth/client/use-current-user';
import { AbacEntityAttr } from '@gamezilla/patch-db/abac/abac-entity-attr';
import {
  andWhereClause,
  type PatchDbQueryWhereClause,
} from '@gamezilla/patch-db/interface';
import { useEntityAttribute, useQuery } from '@gamezilla/patch-db/react';
import { useMemo } from 'react';

import { deriveRecentlyAttemptedPuzzleIds } from '../../shared/chess-puzzle-derive';
import {
  CHESS_PUZZLE_ENTITY_TYPE,
  ChessPuzzleAttr,
} from '../../shared/chess-puzzle-entities';
import {
  CHESS_PUZZLE_INTERACTION_ENTITY_TYPE,
  CHESS_PUZZLE_INTERACTION_KIND,
  ChessPuzzleInteractionAttr,
  interactionRowFromEntityAttributes,
} from '../../shared/chess-puzzle-interaction-entities';
import {
  CHESS_PUZZLE_PROFILE_ENTITY_TYPE,
  ChessPuzzleProfileAttr,
} from '../../shared/chess-puzzle-profile-entities';

const DEFAULT_RATING = 1200;
const PREFERRED_BAND = 50;
const MAX_BAND = 400;

function hashSeed(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function buildPuzzleWhere(
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

/**
 * Selects the next puzzle id by Elo band (+ widening fallback) excluding
 * recently started puzzles.
 */
export function useNextPuzzleId(args: {
  currentPuzzleId: string | null;
  seed: string;
}): { puzzleId: string | null; rating: number; loading: boolean } {
  const { currentPuzzleId, seed } = args;
  const myId = useMyId();

  const profileRating = useEntityAttribute(
    CHESS_PUZZLE_PROFILE_ENTITY_TYPE,
    myId,
    ChessPuzzleProfileAttr.rating
  );
  const rating = profileRating > 0 ? profileRating : DEFAULT_RATING;

  const interactionQuery = useMemo(
    () => ({
      entityType: CHESS_PUZZLE_INTERACTION_ENTITY_TYPE,
      where: {
        type: '=' as const,
        attribute: AbacEntityAttr.owner.key,
        value: myId,
      },
      orderBy: [
        {
          attribute: ChessPuzzleInteractionAttr.at.key,
          direction: 'desc' as const,
        },
      ],
      limit: 200,
    }),
    [myId]
  );

  const interactionResult = useQuery(interactionQuery);
  const excludeIds = useMemo(() => {
    const rows = interactionResult.entities.map((e) =>
      interactionRowFromEntityAttributes(e.attributes)
    );
    const recent = deriveRecentlyAttemptedPuzzleIds(
      rows.filter((r) => r.kind === CHESS_PUZZLE_INTERACTION_KIND.started),
      50
    );
    const s = new Set(recent);
    if (currentPuzzleId !== null) s.add(currentPuzzleId);
    return [...s];
  }, [interactionResult.entities, currentPuzzleId]);

  const puzzleQuery = useMemo(
    () => ({
      entityType: CHESS_PUZZLE_ENTITY_TYPE,
      where: buildPuzzleWhere(rating, MAX_BAND, excludeIds),
      orderBy: [
        {
          attribute: ChessPuzzleAttr.popularity.key,
          direction: 'desc' as const,
        },
      ],
      limit: 50,
    }),
    [rating, excludeIds]
  );

  const puzzleResult = useQuery(puzzleQuery);

  const puzzleId = useMemo(() => {
    const entities = puzzleResult.entities;
    if (entities.length === 0) return null;
    const inBand = entities.filter((e) => {
      const r = ChessPuzzleAttr.rating.from(e.attributes);
      return Math.abs(r - rating) <= PREFERRED_BAND;
    });
    const pool = inBand.length > 0 ? inBand : entities;
    const idx = hashSeed(seed) % pool.length;
    return pool[idx]?.entityId ?? null;
  }, [puzzleResult.entities, rating, seed]);

  return {
    puzzleId,
    rating,
    loading: myId.length === 0 || puzzleResult.isLoading,
  };
}
