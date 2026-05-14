import type { PlayerView } from './adapter';
import type { CandidateCore } from './candidates';
import { intentPriority } from './intents';
import type { SessionState } from './session-model';
import { recencyMultiplier } from './session-model';

const INTENT_GAP_MS = 950;

export function filterGatedCandidates(
  candidates: readonly CandidateCore[],
  player: PlayerView
): CandidateCore[] {
  return candidates.filter((c) => {
    if (c.minSkill !== undefined && player.skill() < c.minSkill) {
      return false;
    }
    if (
      c.minFrustration !== undefined &&
      player.frustration() < c.minFrustration
    ) {
      return false;
    }
    return true;
  });
}

export function filterAfterCooldown(
  candidates: readonly CandidateCore[],
  session: SessionState,
  now: number
): CandidateCore[] {
  return candidates.filter((c) => {
    const lastPayload = session.lastPayloadAt.get(c.payloadRef) ?? -1;
    if (lastPayload >= 0 && now - lastPayload < c.cooldownMs) {
      return false;
    }
    const lastIntent = session.lastIntentAt.get(c.intent) ?? -1;
    if (lastIntent >= 0 && now - lastIntent < INTENT_GAP_MS) {
      return false;
    }
    return true;
  });
}

export function filterAffordable(
  candidates: readonly CandidateCore[],
  budget: number
): CandidateCore[] {
  return candidates.filter((c) => c.cost <= budget);
}

export function computeEffectiveWeights(
  candidates: readonly CandidateCore[],
  session: SessionState,
  player: PlayerView
): number[] {
  return candidates.map((c) => {
    const prio = intentPriority(c.intent);
    const rec = recencyMultiplier(session.recentRefs, c.payloadRef);
    const fr = 1 + player.frustration() * 0.48;
    return c.weight * prio * rec * fr;
  });
}
