import {
  startPuzzleImport,
  stopPuzzleImport,
} from '@libs/chess-puzzle-shared/puzzle-import-mutations';
import { appendPuzzleInteractionMutation } from '@libs/game-puzzle-shared/append-puzzle-interaction-mutation';
import { ratePuzzleAttemptMutation } from '@libs/game-puzzle-shared/rate-puzzle-attempt-mutation';
import { savePuzzleFeedSettingsMutation } from '@libs/game-puzzle-shared/save-puzzle-feed-settings-mutation';

export const CHESS_MUTATIONS = [
  startPuzzleImport,
  stopPuzzleImport,
  appendPuzzleInteractionMutation,
  ratePuzzleAttemptMutation,
  savePuzzleFeedSettingsMutation,
] as const;
