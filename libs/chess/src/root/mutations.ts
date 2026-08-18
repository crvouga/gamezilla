import { appendPuzzleInteractionMutation } from '../use-cases/append-puzzle-interaction/shared/append-puzzle-interaction-mutation';
import { upsertPuzzleProfileMutation } from '../use-cases/upsert-puzzle-profile/shared/upsert-puzzle-profile-mutation';

export const CHESS_MUTATIONS = [
  appendPuzzleInteractionMutation,
  upsertPuzzleProfileMutation,
] as const;
