import { defaultMatchChoice } from '@libs/game-matchmaking-shared-ts/match-choice';
import type { MatchmakingCapability } from '@pkgs/turn-game-shared-ts/game-rules';

/** Each game is sought at its own default choice: 5+0, or play without clocks. */
export function limitProbeChoice(matchmaking: MatchmakingCapability): string {
  return defaultMatchChoice(matchmaking);
}
