import type { Decision } from '@pkgs/permissions-shared/decision';

export const ACCOUNT_PROOF_MAX_AGE_MS = 10 * 60_000;

export function decidePrivacyExportOwner(
  decision: Decision,
  actorId: string,
  ownerId: string
): Decision {
  return actorId === ownerId
    ? decision
    : { ...decision, allowed: false, reason: 'restricted' };
}

/** Additional evidence needed for irreversible account choices. */
export function decidePrivacyAccess(
  accountDecision: Decision,
  evidence: {
    readonly connected: boolean;
    readonly authenticatedAtMs: number | null;
    readonly nowMs: number;
    readonly action?: string;
  }
): Decision {
  if (!accountDecision.allowed) return accountDecision;
  if (!evidence.connected) {
    return {
      ...accountDecision,
      allowed: false,
      reason: 'requires_connection',
    };
  }
  const age =
    evidence.authenticatedAtMs === null
      ? Number.POSITIVE_INFINITY
      : evidence.nowMs - evidence.authenticatedAtMs;
  if (!Number.isFinite(age) || age < 0 || age >= ACCOUNT_PROOF_MAX_AGE_MS) {
    return {
      ...accountDecision,
      allowed: false,
      reason: 'requires_recent_proof',
      ...(evidence.action === undefined
        ? {}
        : { unlockRef: `${evidence.action}#requires_recent_proof` }),
    };
  }
  return accountDecision;
}
