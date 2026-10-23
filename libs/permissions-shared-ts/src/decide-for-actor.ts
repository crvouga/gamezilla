import type { Decision } from '@pkgs/permissions-shared-ts/decision';
import { decide, decideLimit } from '@pkgs/permissions-shared-ts/decision';
import { policyAt } from '@pkgs/permissions-shared-ts/policy';
import { resolveSubject } from '@pkgs/permissions-shared-ts/resolve';

import type {
  AppGrantKey,
  AppLimit,
  SpacePresenceRole,
} from './permission-catalog';
import { ROLE } from './permission-catalog';
import type { AccessIdentity, AccessReader } from './read-access';
import { readAccess } from './read-access';
import { resolveSpaceRoles } from './space-roles';

/** Resource-scoped roles a decision adds on top of the actor's own. */
export type AccessScope = {
  /** The actor's presence in the space the action targets. */
  readonly spacePresence?: SpacePresenceRole | null;
  /** Ownership read from the target document inside the same transaction. */
  readonly puzzleOwnerId?: string;
  readonly puzzlePlayerId?: string;
};

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
  const subject = resolveSubject(policy, access.facts, [
    ...resolveSpaceRoles(args.scope?.spacePresence ?? null),
    ...(args.scope?.puzzleOwnerId === args.identity.actorId
      ? [ROLE.puzzleAuthor]
      : []),
    ...(args.scope?.puzzlePlayerId === args.identity.actorId
      ? [ROLE.puzzlePlayer]
      : []),
  ]);
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
