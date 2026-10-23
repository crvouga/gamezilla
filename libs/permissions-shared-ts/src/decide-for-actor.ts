import type { Decision } from '@pkgs/permissions-shared-ts/decision';
import { decide, decideLimit } from '@pkgs/permissions-shared-ts/decision';
import { policyAt } from '@pkgs/permissions-shared-ts/policy';
import { resolveSubject } from '@pkgs/permissions-shared-ts/resolve';

import type { AccessScope } from './access-scope';
import type { AppGrantKey, AppLimit } from './permission-catalog';
import type { AccessIdentity, AccessReader } from './read-access';
import { readAccess } from './read-access';
import { resolveResourceRoles } from './resource-roles';

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
  const subject = resolveSubject(
    policy,
    access.facts,
    resolveResourceRoles(args.identity.actorId, args.scope)
  );
  return decide(policy, subject, args.key);
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
