import {
  type Decision,
  decide,
  policyAt,
  resolveSubject,
} from '@pkgs/permissions';

import type { AppGrantKey, SpacePresenceRole } from './permission-catalog';
import {
  type AccessIdentity,
  type AccessReader,
  readAccess,
} from './read-access';
import { resolveSpaceRoles } from './space-roles';

/** Resource-scoped roles a decision adds on top of the actor's own. */
export type AccessScope = {
  /** The actor's presence in the space the action targets. */
  readonly spacePresence?: SpacePresenceRole | null;
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
  const subject = resolveSubject(
    policy,
    access.facts,
    resolveSpaceRoles(args.scope?.spacePresence ?? null)
  );
  return decide(policy, subject, args.key);
}
