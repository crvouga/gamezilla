import { appendPuzzleInteractionMutation } from '../use-cases/append-puzzle-interaction/shared/append-puzzle-interaction-mutation';
import { ratePuzzleAttemptMutation } from '../use-cases/rate-puzzle-attempt/shared/rate-puzzle-attempt-mutation';
import { savePuzzleFeedSettingsMutation } from '../use-cases/save-puzzle-feed-settings/shared/save-puzzle-feed-settings-mutation';

export {
  appendPuzzleInteractionMutation,
  ratePuzzleAttemptMutation,
  savePuzzleFeedSettingsMutation,
};

export const CHESS_MUTATIONS = [
  appendPuzzleInteractionMutation,
  ratePuzzleAttemptMutation,
  savePuzzleFeedSettingsMutation,
] as const;
