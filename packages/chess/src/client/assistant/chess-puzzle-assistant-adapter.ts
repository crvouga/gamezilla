import type {
  AssistantCandidate,
  AssistantSignal,
  GameAdapter,
  PlayerView,
} from '@gamezilla/assistant/shared';

import {
  candidatesForInvalid,
  candidatesForProgress,
  candidatesForRetry,
  candidatesForSolved,
  candidatesForStart,
  candidatesForWrong,
} from './chess-puzzle-assistant-branches';
import { CHESS_PUZZLE_SIGNAL } from './chess-puzzle-assistant-signals';
import { pickDialogTheme } from './chess-puzzle-assistant-theme';

export type ChessPuzzleAssistantPayload = {
  readonly themes: readonly string[];
};

export { CHESS_PUZZLE_SIGNAL } from './chess-puzzle-assistant-signals';

export function createChessPuzzleGameAdapter(): GameAdapter<ChessPuzzleAssistantPayload> {
  return {
    proposeCandidates(
      signal: AssistantSignal<ChessPuzzleAssistantPayload>,
      player: PlayerView
    ): readonly AssistantCandidate[] {
      const theme = pickDialogTheme(signal.payload.themes);
      const themeTag = theme ?? 'generic';
      switch (signal.kind) {
        case CHESS_PUZZLE_SIGNAL.invalid:
          return candidatesForInvalid(player);
        case CHESS_PUZZLE_SIGNAL.start:
          return candidatesForStart(theme, themeTag, player);
        case CHESS_PUZZLE_SIGNAL.progress:
          return candidatesForProgress(theme, themeTag, player);
        case CHESS_PUZZLE_SIGNAL.wrong:
          return candidatesForWrong(theme, themeTag, player);
        case CHESS_PUZZLE_SIGNAL.retry:
          return candidatesForRetry(theme, themeTag, player);
        case CHESS_PUZZLE_SIGNAL.solved:
          return candidatesForSolved(theme, themeTag, player);
        default:
          return [];
      }
    },
  };
}
