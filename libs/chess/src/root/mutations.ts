import { appendPuzzleInteractionMutation } from '../use-cases/append-puzzle-interaction/shared/append-puzzle-interaction-mutation';
import { ratePuzzleAttemptMutation } from '../use-cases/rate-puzzle-attempt/shared/rate-puzzle-attempt-mutation';
import { upsertPuzzleProfileMutation } from '../use-cases/upsert-puzzle-profile/shared/upsert-puzzle-profile-mutation';

export {
  appendPuzzleInteractionMutation,
  ratePuzzleAttemptMutation,
  upsertPuzzleProfileMutation,
};

export const CHESS_MUTATIONS = [
  appendPuzzleInteractionMutation,
  ratePuzzleAttemptMutation,
  // Frozen wire name for clients shipped before §8; see its module comment.
  upsertPuzzleProfileMutation,
] as const;
