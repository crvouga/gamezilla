import { MULTIPLAYER_MUTATIONS } from '@libs/chess-matchmaking-shared/multiplayer-mutations';
import { appendPuzzleInteractionMutation } from '@libs/chess-puzzle-shared/append-puzzle-interaction-mutation';
import {
  startPuzzleImport,
  stopPuzzleImport,
} from '@libs/chess-puzzle-shared/puzzle-import-mutations';
import { ratePuzzleAttemptMutation } from '@libs/chess-puzzle-shared/rate-puzzle-attempt-mutation';
import { savePuzzleFeedSettingsMutation } from '@libs/chess-puzzle-shared/save-puzzle-feed-settings-mutation';

export const CHESS_MUTATIONS = [
  startPuzzleImport,
  stopPuzzleImport,
  ...MULTIPLAYER_MUTATIONS,
  appendPuzzleInteractionMutation,
  ratePuzzleAttemptMutation,
  savePuzzleFeedSettingsMutation,
] as const;
