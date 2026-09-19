export type PlayerModelState = {
  skill: number;
  frustration: number;
  hintsUsedThisAttempt: number;
  repeatedMistakeCount: number;
  lastActionAt: number;
};

export function createPlayerModel(now: number): {
  readonly state: PlayerModelState;
  applyTags(tags: readonly string[], at: number): void;
} {
  const state: PlayerModelState = {
    skill: 50,
    frustration: 0,
    hintsUsedThisAttempt: 0,
    repeatedMistakeCount: 0,
    lastActionAt: now,
  };
  return {
    state,
    applyTags(tags: readonly string[], at: number): void {
      const deltaT = Math.max(0, at - state.lastActionAt);
      state.frustration *= Math.exp(-deltaT * 0.00012);
      for (const t of tags) {
        if (t === 'wrong') {
          state.frustration = Math.min(1, state.frustration + 0.22);
          state.repeatedMistakeCount += 1;
        }
        if (t === 'retry') {
          state.hintsUsedThisAttempt += 1;
        }
        if (t === 'solved' || t === 'progress' || t === 'moveCorrect') {
          state.frustration *= 0.78;
          if (t === 'solved') {
            state.hintsUsedThisAttempt = 0;
            state.repeatedMistakeCount = 0;
          }
        }
        if (t === 'start') {
          state.hintsUsedThisAttempt = 0;
          state.repeatedMistakeCount = 0;
        }
      }
      state.lastActionAt = at;
    },
  };
}
