import type { Decision } from '@pkgs/permissions-shared-ts/decision';
import { decide, decideLimit } from '@pkgs/permissions-shared-ts/decision';
import type { Facts } from '@pkgs/permissions-shared-ts/facts';
import type { PolicyVersion } from '@pkgs/permissions-shared-ts/policy';
import { policyAt } from '@pkgs/permissions-shared-ts/policy';
import { resolveSubject } from '@pkgs/permissions-shared-ts/resolve';

import type {
  AppGrantKey,
  AppLimit,
  AppPolicyKey,
  SpacePresenceRole,
} from './permission-catalog';
import type { AccessIdentity, AccessReader } from './read-access';
import { readAccess } from './read-access';
import { resolveSpaceRoles } from './space-roles';

/** Resource-scoped roles a decision adds on top of the actor's own. */
export type AccessScope = {
  /** The actor's presence in the space the action targets. */
  readonly spacePresence?: SpacePresenceRole | null;
};

/** Evaluate one grant from selected policy and facts, without further reads. */
export function decideGrant(args: {
  readonly policy: PolicyVersion<AppPolicyKey, AppLimit>;
  readonly facts: Facts;
  readonly key: AppGrantKey;
  readonly scope?: AccessScope | undefined;
}): Decision {
  const subject = resolveSubject(
    args.policy,
    args.facts,
    resolveSpaceRoles(args.scope?.spacePresence ?? null)
  );
  return decide(args.policy, subject, args.key);
}

/**
 * One grant decision for `identity`, read from synced rows: the policy
 * version active at `clientAtMs`, facts at `nowMs`, plus `scope`'s roles.
 * Server replay, request guards and mutation bodies all decide through it.
 */
export async function decideForActor(
  db: AccessReader,
  args: {
    readonly identity: AccessIdentity;
    readonly key: AppGrantKey;
    readonly nowMs: number;
    readonly clientAtMs: number;
    readonly scope?: AccessScope | undefined;
  }
): Promise<Decision> {
  const access = await readAccess(db, args.identity, args.nowMs);
  const policy = policyAt(access.policy, args.clientAtMs);
  return decideGrant({
    policy,
    facts: access.facts,
    key: args.key,
    scope: args.scope,
  });
}

/**
 * One counted-limit decision for `identity` holding one more of `limit` when
 * it holds `used` now, from the same synced rows as {@link decideForActor}:
 * the device's optimistic apply and the server replay answer alike.
 */
export async function decideLimitForActor(
  db: AccessReader,
  args: {
    readonly identity: AccessIdentity;
    readonly limit: AppLimit;
    readonly used: number;
    readonly nowMs: number;
    readonly clientAtMs: number;
  }
): Promise<Decision> {
  const access = await readAccess(db, args.identity, args.nowMs);
  const policy = policyAt(access.policy, args.clientAtMs);
  const subject = resolveSubject(policy, access.facts, []);
  return decideLimit(policy, subject, args.limit, args.used);
}
