import { appendPuzzleInteractionMutation } from '../use-cases/append-puzzle-interaction/shared/append-puzzle-interaction-mutation';
import { findChessOpponentMutation } from '../use-cases/find-opponent/shared/find-opponent-mutation';
import { playMultiplayerMoveMutation } from '../use-cases/play-multiplayer-move/shared/play-multiplayer-move-mutation';
import { ratePuzzleAttemptMutation } from '../use-cases/rate-puzzle-attempt/shared/rate-puzzle-attempt-mutation';
import { resignMultiplayerMutation } from '../use-cases/resign-multiplayer/shared/resign-multiplayer-mutation';
import { savePuzzleFeedSettingsMutation } from '../use-cases/save-puzzle-feed-settings/shared/save-puzzle-feed-settings-mutation';
import { stopFindingChessOpponentMutation } from '../use-cases/stop-finding-opponent/shared/stop-finding-opponent-mutation';

export {
  appendPuzzleInteractionMutation,
  findChessOpponentMutation,
  playMultiplayerMoveMutation,
  ratePuzzleAttemptMutation,
  resignMultiplayerMutation,
  savePuzzleFeedSettingsMutation,
  stopFindingChessOpponentMutation,
};

export const CHESS_MUTATIONS = [
  findChessOpponentMutation,
  stopFindingChessOpponentMutation,
  playMultiplayerMoveMutation,
  resignMultiplayerMutation,
  appendPuzzleInteractionMutation,
  ratePuzzleAttemptMutation,
  savePuzzleFeedSettingsMutation,
] as const;
