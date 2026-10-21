import { useIsSignedIn } from '@libs/auth-client-ts/access-facts';
import { useMyId } from '@libs/auth-client-ts/use-current-user';
import type { QuotaDenialMeta } from '@libs/permissions-shared-ts/consume-quota-mutation';
import { consumeQuotaMutation } from '@libs/permissions-shared-ts/consume-quota-mutation';
import { evaluateQuota } from '@libs/permissions-shared-ts/evaluate-quota';
import { unitsSince } from '@libs/permissions-shared-ts/ledger-time';
import type {
  AppPolicyKey,
  AppQuota,
} from '@libs/permissions-shared-ts/permission-catalog';
import {
  isQuotaAction,
  PERMISSION,
} from '@libs/permissions-shared-ts/permission-catalog';
import { useClock } from '@pkgs/clock-client-ts/solid';
import type { Decision } from '@pkgs/permissions-shared-ts/decision';
import {
  decide,
  decideQuota,
  quotaWindowOf,
  resolveUnlockRef,
  treatmentOf,
} from '@pkgs/permissions-shared-ts/decision';
import type {
  UiTreatment,
  UnlockEntry,
} from '@pkgs/permissions-shared-ts/policy';
import { policyVersionOf } from '@pkgs/permissions-shared-ts/policy';
import sql from '@pkgs/sql-root-shared-ts/sql';
import { useMutationClient } from '@pkgs/sync-engine-client-ts/mutation-client-context';
import { createQuery } from '@pkgs/sync-engine-client-ts/sync-engine-context';
import { useCreateId } from '@pkgs/uuid-client-ts/solid';
import { usePermissionPolicy } from './use-permission-policy';
import { usePermissionSubject } from './use-permission-subject';
import { usePrivacyDecision } from './use-privacy-decision';

/** The single client permission API (§22.5). Reads are reactive. */
export type Permissions = {
  /** Decision for doing `action` now (a quota: consuming one more unit). */
  readonly can: (action: AppPolicyKey) => Decision;
  /** Units left in the current window; `null` = unlimited / not metered. */
  readonly remaining: (quota: AppQuota) => number | null;
  /** Optimistic local consume; the server replay is authoritative. */
  readonly consume: (
    quota: AppQuota,
    idempotencyKey: string,
    amount?: number
  ) => Promise<Decision>;
  /** `can` + run `onDenied(decision)` when denied; returns `allowed`. */
  readonly gate: (
    action: AppPolicyKey,
    onDenied: (decision: Decision) => void
  ) => boolean;
  /** Per-action UI treatment from config. */
  readonly treatment: (action: AppPolicyKey) => UiTreatment;
  /** Config entry a denial's `unlockRef` points at. */
  readonly unlock: (decision: Decision) => UnlockEntry | undefined;
};

type LedgerRow = {
  readonly quota: string;
  readonly amount: number;
  readonly consumed_at: string;
};

function isDenialMeta(meta: unknown): meta is QuotaDenialMeta {
  if (typeof meta !== 'object' || meta === null) return false;
  const decision = (meta as { decision?: unknown }).decision;
  return typeof decision === 'object' && decision !== null;
}

/**
 * The caller's permissions from local synced state only: the policy row,
 * facts and the consumption ledger. Nothing else in the client reads them.
 */
export function usePermissions(): Permissions {
  const policy = usePermissionPolicy();
  const subject = usePermissionSubject();
  const privacyDecision = usePrivacyDecision();
  const clock = useClock();
  const myId = useMyId();
  const signedIn = useIsSignedIn();
  const createId = useCreateId();
  const mutationClient = useMutationClient();
  const ledger = createQuery(
    () => sql<LedgerRow>`
    SELECT quota, amount, consumed_at
    FROM permissions_quota_ledger
    WHERE owner_id = ${myId()} AND deleted_at IS NULL
  `
  );

  const usedIn = (quota: string, startMs: number): number =>
    unitsSince(
      ledger.rows().filter((row) => row.quota === quota),
      startMs
    );

  const quotaDecision = (quota: AppQuota, amount: number): Decision => {
    const nowMs = clock.now();
    const window = quotaWindowOf(policy(), subject(), quota, { nowMs });
    const used = window === undefined ? 0 : usedIn(quota, window.startMs);
    return decideQuota(policy(), subject(), quota, { used, nowMs, amount });
  };

  const can = (action: AppPolicyKey): Decision => {
    if (isQuotaAction(action)) return quotaDecision(action, 1);
    const decision = decide(policy(), subject(), action);
    return action === PERMISSION.profileDeleteAccount ||
      action === PERMISSION.profileExportData
      ? privacyDecision(action, decision)
      : decision;
  };

  const consume = async (
    quota: AppQuota,
    idempotencyKey: string,
    amount = 1
  ): Promise<Decision> => {
    const result = await mutationClient.mutate(consumeQuotaMutation, {
      id: createId(),
      quota,
      idempotencyKey,
      amount,
    });
    if (!result.ok) {
      const meta = result.failures[0]?.meta;
      if (isDenialMeta(meta)) return meta.decision;
      return {
        allowed: false,
        reason: 'not_granted',
        policyVersion: policyVersionOf(policy()),
      };
    }
    const nowMs = clock.now();
    return evaluateQuota(
      { query: mutationClient.query },
      {
        identity: {
          actorId: myId(),
          accountId: signedIn() ? myId() : null,
          isAnon: !signedIn(),
        },
        quota,
        nowMs,
        clientAtMs: nowMs,
        amount: 0,
      }
    );
  };

  return {
    can,
    remaining: (quota) => quotaDecision(quota, 0).remaining ?? null,
    consume,
    gate: (action, onDenied) => {
      const decision = can(action);
      if (!decision.allowed) onDenied(decision);
      return decision.allowed;
    },
    treatment: (action) =>
      treatmentOf(policy(), action, isQuotaAction(action) ? 'quota' : 'grant'),
    unlock: (decision) =>
      decision.unlockRef === undefined
        ? undefined
        : resolveUnlockRef(policy(), decision.unlockRef),
  };
}
