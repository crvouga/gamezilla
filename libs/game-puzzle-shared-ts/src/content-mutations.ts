import type { PuzzleContentCatalog } from '@pkgs/turn-game-shared-ts/puzzle-content-catalog';
import { createAttemptMutations } from './attempt-mutations';
import { choosePuzzleContentDraftMutation } from './choose-content-draft-mutation';
import { createPuzzleContentMutation } from './create-content-mutation';
import { createPuzzleFromPackMutation } from './create-pack-puzzle-mutation';
import { editPuzzlePackMutation } from './edit-pack-mutation';
import { publishPuzzleContentMutation } from './publish-content-mutation';
import { savePuzzleContentDraftMutation } from './save-content-draft-mutation';
import { validatePuzzleContentDraftMutation } from './validate-content-mutation';
import { withdrawPuzzleContentMutation } from './withdraw-content-mutation';

export function createContentMutations(catalog: PuzzleContentCatalog) {
  return [
    ...createAttemptMutations(catalog),
    createPuzzleContentMutation(catalog),
    editPuzzlePackMutation,
    createPuzzleFromPackMutation(catalog),
    savePuzzleContentDraftMutation,
    choosePuzzleContentDraftMutation,
    validatePuzzleContentDraftMutation(catalog),
    publishPuzzleContentMutation(catalog),
    withdrawPuzzleContentMutation,
  ] as const;
}
