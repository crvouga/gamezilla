import {
  type DenialReason,
  type PolicyVersion,
  policyVersionOf,
  type UiTreatment,
  type UnlockEntry,
} from './policy';
import { quotaWindowBounds, type WindowBounds } from './quota-window';
import {
  permissionsOf,
  quotasOf,
  resolveRoleClosure,
  restrictedOf,
} from './resolve';
import type { Subject } from './subject';

/** The one answer every gate gets. Denials carry a reason, never a tier. */
export type Decision = {
  readonly allowed: boolean;
  readonly reason?: DenialReason;
  /** Units left after this decision (quotas only; absent = unlimited). */
  readonly remaining?: number;
  /** Merged allowance (quotas only; absent = unlimited). */
  readonly limit?: number;
  /** Epoch ms the window resets (calendar/rolling quotas only). */
  readonly resetsAtMs?: number;
  /** Key into the policy's `unlockRefs` (`<action>#<reason>`). */
  readonly unlockRef?: string;
  readonly policyVersion: string;
};

const UNLOCK_SEPARATOR = '#';

function unlockRefFor(
  policy: PolicyVersion,
  action: string,
  reason: DenialReason
): string | undefined {
  return policy.unlockRefs?.[action]?.[reason] === undefined
    ? undefined
    : `${action}${UNLOCK_SEPARATOR}${reason}`;
}

function deny(
  policy: PolicyVersion,
  action: string,
  reason: DenialReason
): Decision {
  const unlockRef = unlockRefFor(policy, action, reason);
  return {
    allowed: false,
    reason,
    ...(unlockRef === undefined ? {} : { unlockRef }),
    policyVersion: policyVersionOf(policy),
  };
}

function notGranted(policy: PolicyVersion, action: string): Decision {
  return deny(policy, action, policy.denialReasons?.[action] ?? 'not_granted');
}

/** Resolves a decision's `unlockRef` to its config entry (undefined = none). */
export function resolveUnlockRef(
  policy: PolicyVersion,
  unlockRef: string
): UnlockEntry | undefined {
  const at = unlockRef.lastIndexOf(UNLOCK_SEPARATOR);
  if (at <= 0) return undefined;
  const action = unlockRef.slice(0, at);
  const reason = unlockRef.slice(at + 1) as DenialReason;
  return policy.unlockRefs?.[action]?.[reason];
}

/** Per-action UI treatment from config; `lock` for grants, `soft` for quotas. */
export function treatmentOf(
  policy: PolicyVersion,
  action: string,
  kind: 'grant' | 'quota'
): UiTreatment {
  return policy.treatments?.[action] ?? (kind === 'quota' ? 'soft' : 'lock');
}

/**
 * Boolean grant decision. Restrictions always win, and report their reason.
 */
export function decide(
  policy: PolicyVersion,
  subject: Subject,
  action: string
): Decision {
  const restricted = restrictedOf(policy, subject).get(action);
  if (restricted !== undefined) return deny(policy, action, restricted);
  if (!permissionsOf(policy, subject).has(action)) {
    return notGranted(policy, action);
  }
  return { allowed: true, policyVersion: policyVersionOf(policy) };
}

/** Input to a quota decision: units already consumed in the window. */
export type QuotaUsage = {
  /** Consumed units whose timestamps fall inside the window at `nowMs`. */
  readonly used: number;
  readonly nowMs: number;
  /** IANA zone for `userLocalMidnight` quotas; null/absent → UTC. */
  readonly timeZone?: string | null;
  /** Units this attempt would consume (default 1). */
  readonly amount?: number;
};

/**
 * Quota decision for consuming `amount` more units. `remaining` is what is
 * left after the attempt when allowed, or what is left now when denied.
 * An undeclared quota is not granted; `limit: null` is unlimited.
 */
export function decideQuota(
  policy: PolicyVersion,
  subject: Subject,
  quota: string,
  usage: QuotaUsage
): Decision {
  const restricted = restrictedOf(policy, subject).get(quota);
  if (restricted !== undefined) return deny(policy, quota, restricted);
  const grant = quotasOf(policy, subject).get(quota);
  if (grant === undefined) return notGranted(policy, quota);
  const version = policyVersionOf(policy);
  if (grant.limit === null) return { allowed: true, policyVersion: version };
  const bounds = quotaWindowBounds({
    grant,
    nowMs: usage.nowMs,
    timeZone: usage.timeZone ?? null,
  });
  const amount = usage.amount ?? 1;
  const allowed = usage.used + amount <= grant.limit;
  const remaining = Math.max(
    0,
    grant.limit - usage.used - (allowed ? amount : 0)
  );
  const reset =
    bounds.resetsAtMs === null ? {} : { resetsAtMs: bounds.resetsAtMs };
  if (!allowed) {
    return {
      ...deny(policy, quota, 'quota_exhausted'),
      remaining,
      limit: grant.limit,
      ...reset,
    };
  }
  return {
    allowed: true,
    remaining,
    limit: grant.limit,
    ...reset,
    policyVersion: version,
  };
}

/** Roles in the subject's closure that grant `action` directly (audit/UX). */
export function grantedBy(
  policy: PolicyVersion,
  subject: Subject,
  action: string
): readonly string[] {
  return resolveRoleClosure(policy, subject.roles).filter(
    (role) =>
      (policy.roles[role]?.permissions ?? []).includes(action) ||
      policy.roles[role]?.quotas?.[action] !== undefined
  );
}

/**
 * The accounting window the subject's merged `quota` grant uses at `nowMs`,
 * so a caller can count consumed units inside it. Undefined when the quota is
 * not granted or unlimited (nothing to count).
 */
export function quotaWindowOf(
  policy: PolicyVersion,
  subject: Subject,
  quota: string,
  at: { readonly nowMs: number; readonly timeZone?: string | null }
): WindowBounds | undefined {
  const grant = quotasOf(policy, subject).get(quota);
  if (grant === undefined || grant.limit === null) return undefined;
  return quotaWindowBounds({
    grant,
    nowMs: at.nowMs,
    timeZone: at.timeZone ?? null,
  });
}
