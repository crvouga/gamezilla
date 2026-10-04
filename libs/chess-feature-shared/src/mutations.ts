import { appendPuzzleInteractionMutation } from '@libs/chess-puzzle-shared/append-puzzle-interaction-mutation';
import { findChessOpponentMutation } from '@libs/chess-matchmaking-shared/find-opponent-mutation';
import { playMultiplayerMoveMutation } from '@libs/chess-matchmaking-shared/play-multiplayer-move-mutation';
import { ratePuzzleAttemptMutation } from '@libs/chess-puzzle-shared/rate-puzzle-attempt-mutation';
import { resignMultiplayerMutation } from '@libs/chess-matchmaking-shared/resign-multiplayer-mutation';
import { savePuzzleFeedSettingsMutation } from '@libs/chess-puzzle-shared/save-puzzle-feed-settings-mutation';
import { stopFindingChessOpponentMutation } from '@libs/chess-matchmaking-shared/stop-finding-opponent-mutation';

export const CHESS_MUTATIONS = [
  findChessOpponentMutation,
  stopFindingChessOpponentMutation,
  playMultiplayerMoveMutation,
  resignMultiplayerMutation,
  appendPuzzleInteractionMutation,
  ratePuzzleAttemptMutation,
  savePuzzleFeedSettingsMutation,
] as const;
