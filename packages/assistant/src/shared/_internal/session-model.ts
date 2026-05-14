const MAX_BUDGET = 96;
const REGEN_PER_MS = 0.01;
const RECENCY_PENALTY = 0.38;
const RECENT_CAP = 12;

export type SessionState = {
  lastUpdateAt: number;
  budget: number;
  lastPayloadAt: Map<string, number>;
  lastIntentAt: Map<string, number>;
  recentRefs: string[];
};

export function createSessionState(now: number): SessionState {
  return {
    lastUpdateAt: now,
    budget: MAX_BUDGET,
    lastPayloadAt: new Map(),
    lastIntentAt: new Map(),
    recentRefs: [],
  };
}

export function regenerateBudget(session: SessionState, now: number): void {
  const dt = Math.max(0, now - session.lastUpdateAt);
  session.budget = Math.min(MAX_BUDGET, session.budget + dt * REGEN_PER_MS);
  session.lastUpdateAt = now;
}

export function recencyMultiplier(
  recentRefs: readonly string[],
  ref: string
): number {
  return recentRefs.includes(ref) ? RECENCY_PENALTY : 1;
}

export function pushRecentRef(session: SessionState, ref: string): void {
  const next = [...session.recentRefs.filter((r) => r !== ref), ref];
  session.recentRefs = next.slice(-RECENT_CAP);
}

export function getMaxBudget(): number {
  return MAX_BUDGET;
}
