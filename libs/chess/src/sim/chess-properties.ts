import { actorIds } from '@libs/sim-harness/system/observations';
import type { ProductSim } from '@libs/sim-harness/system/sim';
import { defineProperty } from '@pkgs/sim';
import { pressPuzzleNext } from './chess-actions';
import { readActivePuzzleId } from './chess-puzzle-ui';

type NextPuzzleModel = {
  readonly previousIdByActorId: Readonly<Record<string, string>>;
};

/**
 * After `pressPuzzleNext`, the active puzzle id must differ from the
 * pre-update model. Other checkpoints only refresh the model from SoT.
 */
export const nextPuzzleDifferent = defineProperty({
  name: 'nextPuzzleDifferent',
  setup: (): NextPuzzleModel => ({ previousIdByActorId: {} }),
  check: async (s: ProductSim, model, action) => {
    const previousIdByActorId = { ...model.previousIdByActorId };

    if (pressPuzzleNext.is(action)) {
      const actorId = action.args[0];
      if (typeof actorId === 'string') {
        const puzzleId = await readActivePuzzleId(s, actorId);
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
      const puzzleId = await readActivePuzzleId(s, actorId);
      if (puzzleId !== null) previousIdByActorId[actorId] = puzzleId;
    }
    return { previousIdByActorId };
  },
});
