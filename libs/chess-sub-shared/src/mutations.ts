import { appendPuzzleInteractionMutation } from '@libs/chess-puzzle-shared/append-puzzle-interaction-mutation';
import { ratePuzzleAttemptMutation } from '@libs/chess-puzzle-shared/rate-puzzle-attempt-mutation';
import { savePuzzleFeedSettingsMutation } from '@libs/chess-puzzle-shared/save-puzzle-feed-settings-mutation';

export const CHESS_MUTATIONS = [
  appendPuzzleInteractionMutation,
  ratePuzzleAttemptMutation,
  savePuzzleFeedSettingsMutation,
] as const;
