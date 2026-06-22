import { useMyId } from '@libs/auth/client/use-current-user';
import { AbacEntityAttr } from '@pkgs/patch-db/abac/abac-entity-attr';
import type { PatchDbQuery } from '@pkgs/patch-db/interface';
import { useEntityAttribute, useQuery } from '@pkgs/patch-db/react';
import { useMemo } from 'react';

import {
  CHESS_PUZZLE_ENTITY_TYPE,
  ChessPuzzleAttr,
} from '../../shared/chess-puzzle-entities';
import {
  CHESS_PUZZLE_INTERACTION_ENTITY_TYPE,
  ChessPuzzleInteractionAttr,
  interactionRowFromEntityAttributes,
  type ChessPuzzleInteractionRow,
} from '../../shared/chess-puzzle-interaction-entities';

export function usePuzzleEntity(puzzleId: string): {
  fen: string;
  movesStr: string;
  rating: number;
  themes: readonly string[];
} {
  const selectedPuzzleSyncQuery = useMemo(
    (): PatchDbQuery => ({
      entityType: CHESS_PUZZLE_ENTITY_TYPE,
      where: {
        type: '=',
        attribute: ChessPuzzleAttr.id.key,
        value: puzzleId,
      },
      limit: 1,
    }),
    [puzzleId]
  );
  // The subscription itself triggers a server fetch when the query changes;
  // a manual `runPollNow` here was firing on every puzzle transition and
  // adding round-trip latency for no benefit.
  void useQuery(selectedPuzzleSyncQuery);

  const fen = useEntityAttribute(
    CHESS_PUZZLE_ENTITY_TYPE,
    puzzleId,
    ChessPuzzleAttr.fen
  );
  const movesStr = useEntityAttribute(
    CHESS_PUZZLE_ENTITY_TYPE,
    puzzleId,
    ChessPuzzleAttr.moves
  );
  const rating = useEntityAttribute(
    CHESS_PUZZLE_ENTITY_TYPE,
    puzzleId,
    ChessPuzzleAttr.rating
  );
  const themes = useEntityAttribute(
    CHESS_PUZZLE_ENTITY_TYPE,
    puzzleId,
    ChessPuzzleAttr.themes
  );

  return { fen, movesStr, rating, themes };
}

export function usePuzzleInteractions(
  puzzleId: string
): ChessPuzzleInteractionRow[] {
  const myId = useMyId();
  const query = useMemo(
    (): PatchDbQuery => ({
      entityType: CHESS_PUZZLE_INTERACTION_ENTITY_TYPE,
      where: {
        type: 'and',
        clauses: [
          {
            type: '=',
            attribute: AbacEntityAttr.owner.key,
            value: myId,
          },
          {
            type: '=',
            attribute: ChessPuzzleInteractionAttr.puzzleId.key,
            value: puzzleId,
          },
        ],
      },
      orderBy: [
        {
          attribute: ChessPuzzleInteractionAttr.at.key,
          direction: 'asc',
        },
      ],
      limit: 100,
    }),
    [myId, puzzleId]
  );
  const result = useQuery(query);
  return useMemo(
    () =>
      result.entities.map((e) =>
        interactionRowFromEntityAttributes(e.attributes)
      ),
    [result.entities]
  );
}

export function useChessPuzzleAllInteractions(): ChessPuzzleInteractionRow[] {
  const myId = useMyId();
  const query = useMemo(
    (): PatchDbQuery => ({
      entityType: CHESS_PUZZLE_INTERACTION_ENTITY_TYPE,
      where: {
        type: '=',
        attribute: AbacEntityAttr.owner.key,
        value: myId,
      },
      orderBy: [
        {
          attribute: ChessPuzzleInteractionAttr.at.key,
          direction: 'desc',
        },
      ],
      limit: 100,
    }),
    [myId]
  );
  const result = useQuery(query);
  return useMemo(
    () =>
      result.entities.map((e) =>
        interactionRowFromEntityAttributes(e.attributes)
      ),
    [result.entities]
  );
}

export function usePuzzleEntityAndInteractions(puzzleId: string): {
  fen: string;
  movesStr: string;
  rating: number;
  themes: readonly string[];
  interactions: ChessPuzzleInteractionRow[];
} {
  const base = usePuzzleEntity(puzzleId);
  const interactions = usePuzzleInteractions(puzzleId);
  return { ...base, interactions };
}
