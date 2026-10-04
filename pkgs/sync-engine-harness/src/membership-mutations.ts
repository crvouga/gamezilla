import sql from '@pkgs/sql-shared/sql';
import { defineMutation } from '@pkgs/sync-engine-shared/define-mutation';
import type { MutationDb, MutationEnv } from '@pkgs/sync-engine-shared/mutations-types';
import { MutationError } from '@pkgs/sync-engine-shared/mutations-types';
import { z } from 'zod';

function membershipRowId(spaceId: string, userId: string): string {
  return `${spaceId}:${userId}`;
}

function openSessionRowId(deviceId: string, spaceId: string): string {
  return `${deviceId}:${spaceId}`;
}

async function openSession(
  tx: MutationDb,
  env: MutationEnv,
  spaceId: string
): Promise<void> {
  const id = openSessionRowId(env.deviceId, spaceId);
  const now = env.now().toISOString();
  await tx.run(sql`
    INSERT INTO spaces_open_sessions (id, space_id, device_id, opened_at)
    VALUES (${id}, ${spaceId}, ${env.deviceId}, ${now})
    ON CONFLICT (id) DO UPDATE SET
      space_id = excluded.space_id,
      device_id = excluded.device_id,
      opened_at = excluded.opened_at,
      deleted_at = NULL
  `);
}

/** Create a space, join the actor, and open it on this device. */
export const createSpace = defineMutation({
  name: 'createSpace',
  args: z.object({ id: z.string(), title: z.string().optional() }),
  async run({ tx, env }, { id, title }) {
    const spaceTitle = title ?? '';
    await tx.run(sql`
      INSERT INTO spaces (id, title, owner_id)
      VALUES (${id}, ${spaceTitle}, ${env.actorId})
      ON CONFLICT (id) DO UPDATE SET
        title = excluded.title,
        owner_id = excluded.owner_id,
        deleted_at = NULL
    `);
    const memberId = membershipRowId(id, env.actorId);
    await tx.run(sql`
      INSERT INTO spaces_users (id, space_id, user_id)
      VALUES (${memberId}, ${id}, ${env.actorId})
      ON CONFLICT (id) DO UPDATE SET
        space_id = excluded.space_id,
        user_id = excluded.user_id,
        deleted_at = NULL
    `);
    await openSession(tx, env, id);
  },
});

/** Join an existing space (membership row only). */
export const joinSpace = defineMutation({
  name: 'joinSpace',
  args: z.object({ spaceId: z.string() }),
  async run({ tx, env }, { spaceId }) {
    if (env.serverNow !== undefined) {
      const spaces = await tx.query(sql<{ id: string }>`
        SELECT id FROM spaces
        WHERE id = ${spaceId} AND deleted_at IS NULL
      `);
      if (spaces[0] === undefined) {
        throw new MutationError('NOT_FOUND', 'Space does not exist');
      }
    }
    const memberId = membershipRowId(spaceId, env.actorId);
    await tx.run(sql`
      INSERT INTO spaces_users (id, space_id, user_id)
      VALUES (${memberId}, ${spaceId}, ${env.actorId})
      ON CONFLICT (id) DO UPDATE SET
        space_id = excluded.space_id,
        user_id = excluded.user_id,
        deleted_at = NULL
    `);
    await openSession(tx, env, spaceId);
  },
});

/** Leave a space — soft-delete the actor's membership + this device session. */
export const leaveSpace = defineMutation({
  name: 'leaveSpace',
  args: z.object({ spaceId: z.string() }),
  async run({ tx, env }, { spaceId }) {
    const now = env.now().toISOString();
    const memberId = membershipRowId(spaceId, env.actorId);
    await tx.run(sql`
      UPDATE spaces_users
      SET deleted_at = ${now}
      WHERE id = ${memberId} AND deleted_at IS NULL
    `);
    await tx.run(sql`
      UPDATE spaces_open_sessions
      SET deleted_at = ${now}
      WHERE id = ${openSessionRowId(env.deviceId, spaceId)}
        AND deleted_at IS NULL
    `);
  },
});

/** Soft-delete a space owned by the actor (drops live memberships). */
export const endSpace = defineMutation({
  name: 'endSpace',
  args: z.object({ spaceId: z.string() }),
  async run({ tx, env }, { spaceId }) {
    const rows = await tx.query(sql<{ owner_id: string }>`
      SELECT owner_id FROM spaces
      WHERE id = ${spaceId} AND deleted_at IS NULL
    `);
    const row = rows[0];
    if (row === undefined) return;
    if (row.owner_id !== env.actorId) {
      throw new MutationError('FORBIDDEN', 'Only the space owner can end it');
    }
    const now = env.now().toISOString();
    await tx.run(sql`
      UPDATE spaces
      SET deleted_at = ${now}
      WHERE id = ${spaceId} AND deleted_at IS NULL
    `);
    await tx.run(sql`
      UPDATE spaces_users
      SET deleted_at = ${now}
      WHERE space_id = ${spaceId} AND deleted_at IS NULL
    `);
    await tx.run(sql`
      UPDATE spaces_open_sessions
      SET deleted_at = ${now}
      WHERE space_id = ${spaceId} AND deleted_at IS NULL
    `);
  },
});

/** Upsert a note scoped to a space (live fanout on room topic). */
export const setSpaceNote = defineMutation({
  name: 'setSpaceNote',
  args: z.object({
    id: z.string(),
    spaceId: z.string(),
    body: z.string(),
    title: z.string().optional(),
  }),
  async run({ tx, env }, { id, spaceId, body, title }) {
    if (env.serverNow !== undefined) {
      const members = await tx.query(sql<{ id: string }>`
        SELECT id FROM spaces_users
        WHERE space_id = ${spaceId}
          AND user_id = ${env.actorId}
          AND deleted_at IS NULL
      `);
      if (members[0] === undefined) {
        throw new MutationError('FORBIDDEN', 'Not a member of this space');
      }
    }
    const noteTitle = title ?? '';
    await tx.run(sql`
      INSERT INTO notes (id, folder_id, space_id, title, body, owner_id)
      VALUES (${id}, ${null}, ${spaceId}, ${noteTitle}, ${body}, ${env.actorId})
      ON CONFLICT (id) DO UPDATE SET
        folder_id = excluded.folder_id,
        space_id = excluded.space_id,
        title = excluded.title,
        body = excluded.body,
        owner_id = excluded.owner_id,
        deleted_at = NULL
    `);
  },
});
