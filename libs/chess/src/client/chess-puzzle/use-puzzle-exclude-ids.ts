import { useMyId } from '@libs/auth/client/use-current-user';
import { AbacEntityAttr } from '@pkgs/patch-db/abac/abac-entity-attr';
import { useQuery } from '@pkgs/patch-db/react';
import { useMemo } from 'react';

import { deriveRecentlyAttemptedPuzzleIds } from '../../shared/chess-puzzle-derive';
import {
  CHESS_PUZZLE_INTERACTION_ENTITY_TYPE,
  CHESS_PUZZLE_INTERACTION_KIND,
  ChessPuzzleInteractionAttr,
  interactionRowFromEntityAttributes,
} from '../../shared/chess-puzzle-interaction-entities';

export function usePuzzleExcludeIds(
  currentPuzzleId: string | null
): readonly string[] {
  const myId = useMyId();
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
  return useMemo(() => {
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
}
