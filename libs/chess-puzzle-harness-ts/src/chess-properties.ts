import {
  moveOnToNextPuzzle,
  readPuzzleOnBoard,
} from '@libs/game-session-harness-ts/puzzle-screen';
import type { ProductHarness } from '@libs/harness-ts/harness';
import { actorIds } from '@libs/harness-ts/observations';
import { defineProperty } from '@pkgs/harness-root-shared-ts/define-property';

type NextPuzzleModel = {
  readonly previousIdByActorId: Readonly<Record<string, string>>;
};

/**
 * After `moveOnToNextPuzzle`, the active puzzle id must differ from the
 * pre-update model. Other checkpoints only refresh the model from SoT.
 */
export const nextPuzzleDifferent = defineProperty({
  name: 'nextPuzzleDifferent',
  setup: (): NextPuzzleModel => ({ previousIdByActorId: {} }),
  check: async (s: ProductHarness, model, action) => {
    const previousIdByActorId = { ...model.previousIdByActorId };

    if (moveOnToNextPuzzle.is(action)) {
      const actorId = action.args[0];
      if (typeof actorId === 'string') {
        const puzzleId = await readPuzzleOnBoard(s, actorId);
        if (puzzleId !== null) {
          const previous = model.previousIdByActorId[actorId];
          if (previous !== undefined && puzzleId === previous) {
            throw new Error(
              `next puzzle must differ (actor=${actorId}, id=${puzzleId})`
            );
          }
        }
      }
    }

    for (const actorId of actorIds(s)) {
      const puzzleId = await readPuzzleOnBoard(s, actorId);
      if (puzzleId !== null) previousIdByActorId[actorId] = puzzleId;
    }
    return { previousIdByActorId };
  },
});
