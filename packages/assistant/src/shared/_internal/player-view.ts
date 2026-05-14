import type { PlayerView } from './adapter';
import type { PlayerModelState } from './player-model';

export function createPlayerView(args: {
  getState: () => PlayerModelState;
  clockNow: () => number;
}): PlayerView {
  return {
    skill: () => args.getState().skill,
    frustration: () => args.getState().frustration,
    hintsUsedThisAttempt: () => args.getState().hintsUsedThisAttempt,
    repeatedMistakeCount: () => args.getState().repeatedMistakeCount,
    msSinceLastAction: () => {
      const dt = args.clockNow() - args.getState().lastActionAt;
      return dt > 0 ? dt : 0;
    },
  };
}
