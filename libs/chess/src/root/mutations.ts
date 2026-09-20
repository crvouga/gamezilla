import { appendPuzzleInteractionMutation } from '../use-cases/append-puzzle-interaction/shared/append-puzzle-interaction-mutation';
import { ratePuzzleAttemptMutation } from '../use-cases/rate-puzzle-attempt/shared/rate-puzzle-attempt-mutation';

export { appendPuzzleInteractionMutation, ratePuzzleAttemptMutation };

export const CHESS_MUTATIONS = [
  appendPuzzleInteractionMutation,
  ratePuzzleAttemptMutation,
] as const;
