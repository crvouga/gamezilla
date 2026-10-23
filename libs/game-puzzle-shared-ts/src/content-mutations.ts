import { createPuzzleContentMutation } from './create-content-mutation';
import { createPuzzleFromPackMutation } from './create-pack-puzzle-mutation';
import { editPuzzlePackMutation } from './edit-pack-mutation';
import { publishPuzzleContentMutation } from './publish-content-mutation';
import { savePuzzleContentDraftMutation } from './save-content-draft-mutation';
import { validatePuzzleContentDraftMutation } from './validate-content-mutation';
import { withdrawPuzzleContentMutation } from './withdraw-content-mutation';

export const CONTENT_MUTATIONS = [
  ...ATTEMPT_MUTATIONS,
  createPuzzleContentMutation,
  editPuzzlePackMutation,
  createPuzzleFromPackMutation,
  savePuzzleContentDraftMutation,
  validatePuzzleContentDraftMutation,
  publishPuzzleContentMutation,
  withdrawPuzzleContentMutation,
] as const;

import { ATTEMPT_MUTATIONS } from './attempt-mutations';
