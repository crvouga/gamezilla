import { appendPuzzleInteractionMutation } from '../use-cases/append-puzzle-interaction/shared/append-puzzle-interaction-mutation';
import { ratePuzzleAttemptMutation } from '../use-cases/rate-puzzle-attempt/shared/rate-puzzle-attempt-mutation';
import { savePuzzleFeedSettingsMutation } from '../use-cases/save-puzzle-feed-settings/shared/save-puzzle-feed-settings-mutation';
import { upsertPuzzleProfileMutation } from '../use-cases/upsert-puzzle-profile/shared/upsert-puzzle-profile-mutation';

export {
  appendPuzzleInteractionMutation,
  ratePuzzleAttemptMutation,
  savePuzzleFeedSettingsMutation,
  upsertPuzzleProfileMutation,
};

export const CHESS_MUTATIONS = [
  appendPuzzleInteractionMutation,
  ratePuzzleAttemptMutation,
  savePuzzleFeedSettingsMutation,
  // Frozen wire name for clients shipped before §8; see its module comment.
  upsertPuzzleProfileMutation,
] as const;
