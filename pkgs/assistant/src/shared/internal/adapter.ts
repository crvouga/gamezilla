import type { AssistantCandidate } from './candidates';
import type { AssistantSignal } from './signals';

export type PlayerView = {
  skill(): number;
  frustration(): number;
  hintsUsedThisAttempt(): number;
  repeatedMistakeCount(): number;
  msSinceLastAction(): number;
};

export type GameAdapter<TPayload> = {
  proposeCandidates(
    signal: AssistantSignal<TPayload>,
    player: PlayerView
  ): readonly AssistantCandidate[];
};
