import type { Decision } from '@pkgs/permissions-shared-ts/decision';
import { policyAt } from '@pkgs/permissions-shared-ts/policy';
import type { MutationCtx } from '@pkgs/sync-engine-shared-ts/mutations-types';
import type { AccessScope } from './access-scope';
import { decideGrant } from './decide-for-actor';
import { requireGrantDecision } from './mutation-permission';
import type { AppGrantKey } from './permission-catalog';
import { readAccess } from './read-access';

const evaluate = Symbol('mutationPermissionSnapshot');

/** A read-only permission view for consecutive grant checks before any writes. */
export type MutationPermissionSnapshot = {
  readonly [evaluate]: (key: AppGrantKey, scope?: AccessScope) => Decision;
};

/**
 * Capture policy, facts and time once. Callers pass the snapshot explicitly and
 * discard it before writes; a later phase or transaction reads its own snapshot.
 * The value retains no database reader and exposes no mutable policy or facts.
 */
export async function readMutationPermissionSnapshot(
  ctx: MutationCtx
): Promise<MutationPermissionSnapshot> {
  const nowMs = (ctx.env.serverNow ?? ctx.env.now)().getTime();
  const clientAtMs = Math.min(ctx.env.now().getTime(), nowMs);
  const access = await readAccess(ctx.tx, ctx.env, nowMs);
  const policy = structuredClone(policyAt(access.policy, clientAtMs));
  const facts = access.facts;
  return Object.freeze({
    [evaluate]: (key: AppGrantKey, scope?: AccessScope) =>
      decideGrant({ actorId: ctx.env.actorId, policy, facts, key, scope }),
  });
}

export function decideInMutationSnapshot(
  snapshot: MutationPermissionSnapshot,
  key: AppGrantKey,
  scope?: AccessScope
): Decision {
  return snapshot[evaluate](key, scope);
}

export function requireInMutationSnapshot(
  snapshot: MutationPermissionSnapshot,
  key: AppGrantKey,
  scope?: AccessScope
): void {
  const decision = decideInMutationSnapshot(snapshot, key, scope);
  requireGrantDecision(key, decision);
}
