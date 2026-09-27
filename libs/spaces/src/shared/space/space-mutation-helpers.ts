import { decideInMutation } from '@libs/permissions/public/mutation-permission';
import type { AppPermission } from '@libs/permissions/public/permission-catalog';
import { sql } from '@pkgs/sql';
import {
  type MutationDb,
  type MutationEnv,
  MutationError,
} from '@pkgs/sync-engine/shared';
import { z } from 'zod';
import {
  resolveSpaceMemberId,
  spaceOpenSessionEntityId,
} from './participation/participation-ids';
import { isSpaceHostActor } from './participation/space-participation-policy';
import { SPACE_VISIBILITIES } from './space-visibility';

type SpaceHostRow = {
  readonly host_id: string | null;
  readonly host_member_id: string | null;
  readonly host_account_id: string | null;
  readonly ended_at: string | null;
  readonly visibility: string | null;
};

export const spaceIdArgs = z.object({ spaceId: z.string().min(1) });
export const visibilityArgs = z.enum(SPACE_VISIBILITIES);

/**
 * Space actor id: the signed-in account, or the install's `users.id` for a
 * guest. Guests can host and join; membership rows are keyed by this id.
 */
export function spaceActorId(env: MutationEnv): string {
  const id = env.accountId ?? env.actorId;
  if (id.length === 0) {
    throw new MutationError('SPACE_NOT_SIGNED_IN', 'Sign in to manage spaces.');
  }
  return id;
}

export function memberId(env: MutationEnv): string {
  return resolveSpaceMemberId(spaceActorId(env));
}

export async function getSpaceHost(
  tx: MutationDb,
  spaceId: string
): Promise<SpaceHostRow> {
  const rows = await tx.query(sql<SpaceHostRow>`
    SELECT host_id, host_member_id, host_account_id, ended_at, visibility
    FROM spaces WHERE id = ${spaceId} LIMIT 1
  `);
  const row = rows[0];
  if (row === undefined || row.host_id === null || row.host_id.length === 0) {
    throw new MutationError('SPACE_NOT_FOUND', 'Space not found.');
  }
  return row;
}

export function hostMemberId(row: SpaceHostRow): string {
  return row.host_member_id ?? row.host_account_id ?? row.host_id!;
}

export function isHost(env: MutationEnv, row: SpaceHostRow): boolean {
  return isSpaceHostActor({
    hostId: row.host_id!,
    hostMemberId: hostMemberId(row),
    hostAccountId: row.host_account_id,
    memberId: memberId(env),
    accountId: env.accountId,
    deviceId: env.deviceId,
  });
}

export async function requireSpacePermission(
  tx: MutationDb,
  env: MutationEnv,
  args: {
    readonly spaceId: string;
    readonly permission: AppPermission;
    readonly message: string;
  }
): Promise<void> {
  const row = await getSpaceHost(tx, args.spaceId);
  const decision = await decideInMutation({ tx, env }, args.permission, {
    spacePresence: isHost(env, row) ? 'host' : 'guest',
  });
  if (!decision.allowed) {
    throw new MutationError('SPACE_PERMISSION_DENIED', args.message);
  }
}

export async function openSession(
  tx: MutationDb,
  env: MutationEnv,
  spaceId: string,
  joinAnnounced = false
): Promise<void> {
  const id = spaceOpenSessionEntityId(env.deviceId, spaceId);
  const now = env.now().toISOString();
  // Single upsert — skip pre-SELECT (saves a remote Postgres RTT).
  await tx.run(sql`
    INSERT INTO spaces_open_sessions (
      id, space_id, device_id, opened_at, join_announced, deleted_at
    )
    VALUES (
      ${id},
      ${spaceId},
      ${env.deviceId},
      ${now},
      ${joinAnnounced},
      ${null}
    )
    ON CONFLICT (id) DO UPDATE SET
      deleted_at = NULL,
      opened_at = excluded.opened_at,
      join_announced = excluded.join_announced,
      space_id = excluded.space_id,
      device_id = excluded.device_id
  `);
}

export async function closeSession(
  tx: MutationDb,
  env: MutationEnv,
  spaceId: string
): Promise<void> {
  const now = env.now().toISOString();
  await tx.run(sql`
    UPDATE spaces_open_sessions
    SET deleted_at = ${now}
    WHERE space_id = ${spaceId}
      AND device_id = ${env.deviceId}
      AND deleted_at IS NULL
  `);
}

/**
 * Ending a live space tombstones membership rows; held-row topic projection
 * drops the room subscribe. attachPush syncs topics incrementally (no MQTT
 * remake) so same-account peers still receive createSpace on user:{account}.
 */
export async function endSpace(
  tx: MutationDb,
  env: MutationEnv,
  spaceId: string
): Promise<void> {
  const now = env.now().toISOString();
  await tx.run(sql`
    UPDATE spaces
    SET ended_at = ${now},
        host_id = ${env.deviceId},
        host_member_id = ${memberId(env)},
        host_account_id = ${env.accountId}
    WHERE id = ${spaceId} AND ended_at IS NULL
  `);
  await tx.run(sql`
    UPDATE spaces_open_sessions
    SET deleted_at = ${now}
    WHERE space_id = ${spaceId} AND deleted_at IS NULL
  `);
  await tx.run(sql`
    UPDATE spaces_open_sessions
    SET deleted_at = ${now}
    WHERE deleted_at IS NULL
      AND space_id IN (SELECT id FROM spaces WHERE ended_at IS NOT NULL)
  `);
}
