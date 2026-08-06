import {
  spaceOpenSessionEntityId,
  spaceUserEntityId,
  SPACE_OPEN_SESSIONS_TABLE,
  SPACE_USERS_TABLE,
  SPACES_TABLE,
} from '@libs/db/shared/space-tables';
import { resolveSpaceMemberId } from '@libs/spaces/shared/participation/participation-ids';
import { isSpaceHostActor } from '@libs/spaces/shared/participation/space-participation-policy';
import { SPACE_VISIBILITIES } from '@libs/spaces/shared/space-visibility';
import { defineMutation } from '@pkgs/mutations/core/define-mutation';
import {
  MutationError,
  type MutationDb,
  type MutationEnv,
} from '@pkgs/mutations/core/types';
import { sql } from '@pkgs/sql';
import { z } from 'zod';

type SpaceHostRow = {
  readonly host_id: string | null;
  readonly host_member_id: string | null;
  readonly host_account_id: string | null;
  readonly ended_at: string | null;
  readonly visibility: string | null;
};

const spaceIdArgs = z.object({ spaceId: z.string().min(1) });
const visibilityArgs = z.enum(SPACE_VISIBILITIES);

function accountId(env: MutationEnv): string {
  if (env.accountId === null || env.accountId.length === 0 || env.isAnon) {
    throw new MutationError('SPACE_NOT_SIGNED_IN', 'Sign in to manage spaces.');
  }
  return env.accountId;
}

function memberId(env: MutationEnv): string {
  return resolveSpaceMemberId(accountId(env));
}

async function getSpaceHost(
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

function hostMemberId(row: SpaceHostRow): string {
  return row.host_member_id ?? row.host_account_id ?? row.host_id!;
}

function isHost(env: MutationEnv, row: SpaceHostRow): boolean {
  return isSpaceHostActor({
    hostId: row.host_id!,
    hostMemberId: hostMemberId(row),
    hostAccountId: row.host_account_id,
    memberId: memberId(env),
    accountId: env.accountId,
    deviceId: env.deviceId,
  });
}

async function requireHost(
  tx: MutationDb,
  env: MutationEnv,
  spaceId: string,
  message: string
): Promise<void> {
  const row = await getSpaceHost(tx, spaceId);
  if (!isHost(env, row)) {
    throw new MutationError('SPACE_HOST_REQUIRED', message);
  }
}

async function openSession(
  tx: MutationDb,
  env: MutationEnv,
  spaceId: string
): Promise<void> {
  const id = spaceOpenSessionEntityId(env.deviceId, spaceId);
  const existing = await tx.query(sql<{ readonly id: string }>`
    SELECT id FROM space_open_sessions WHERE id = ${id} LIMIT 1
  `);
  if (existing.length > 0) return;
  await tx.run(sql`
    INSERT INTO space_open_sessions (id, space_id, device_id, opened_at, join_announced)
    VALUES (${id}, ${spaceId}, ${env.deviceId}, ${env.now().toISOString()}, ${0})
    ON CONFLICT (id) DO NOTHING
  `);
}

async function closeSession(
  tx: MutationDb,
  env: MutationEnv,
  spaceId: string
): Promise<void> {
  await tx.run(sql`
    DELETE FROM space_open_sessions
    WHERE id = ${spaceOpenSessionEntityId(env.deviceId, spaceId)}
  `);
}

async function endSpace(
  tx: MutationDb,
  env: MutationEnv,
  spaceId: string
): Promise<void> {
  const actorAccountId = accountId(env);
  await tx.run(sql`
    UPDATE spaces
    SET ended_at = ${env.now().toISOString()},
        host_id = ${env.deviceId},
        host_member_id = ${memberId(env)},
        host_account_id = ${actorAccountId}
    WHERE id = ${spaceId} AND ended_at IS NULL
  `);
  await tx.run(sql`
    DELETE FROM space_open_sessions WHERE space_id = ${spaceId}
  `);
  await tx.run(sql`
    DELETE FROM space_open_sessions
    WHERE space_id IN (SELECT id FROM spaces WHERE ended_at IS NOT NULL)
  `);
}

export const createSpaceMutation = defineMutation({
  name: 'createSpace',
  args: z.object({ spaceId: z.string().min(1), visibility: visibilityArgs }),
  writes: [
    SPACES_TABLE.tableName,
    SPACE_USERS_TABLE.tableName,
    SPACE_OPEN_SESSIONS_TABLE.tableName,
  ],
  async run({ tx, env }, { spaceId, visibility }) {
    const actorAccountId = accountId(env);
    const actorMemberId = memberId(env);
    const now = env.now().toISOString();
    await tx.run(sql`
      INSERT INTO spaces (id, host_id, host_member_id, host_account_id, visibility, created_at)
      VALUES (${spaceId}, ${env.deviceId}, ${actorMemberId}, ${actorAccountId}, ${visibility}, ${now})
      ON CONFLICT (id) DO UPDATE SET
        host_id = excluded.host_id,
        host_member_id = excluded.host_member_id,
        host_account_id = excluded.host_account_id,
        visibility = excluded.visibility
    `);
    await tx.run(sql`
      INSERT INTO space_users (id, space_id, user_id, created_at, created_by_account_id)
      VALUES (${spaceUserEntityId(spaceId, actorMemberId)}, ${spaceId}, ${actorMemberId}, ${now}, ${actorAccountId})
      ON CONFLICT (id) DO NOTHING
    `);
    await openSession(tx, env, spaceId);
  },
});

export const joinSpaceMutation = defineMutation({
  name: 'joinSpace',
  args: spaceIdArgs,
  writes: [SPACE_USERS_TABLE.tableName, SPACE_OPEN_SESSIONS_TABLE.tableName],
  async run({ tx, env }, { spaceId }) {
    const actorAccountId = accountId(env);
    const row = await getSpaceHost(tx, spaceId);
    if (row.ended_at !== null) {
      throw new MutationError('SPACE_ENDED', 'This space has ended.');
    }
    const actorMemberId = memberId(env);
    const id = spaceUserEntityId(spaceId, actorMemberId);
    const present = await tx.query(sql<{ readonly id: string }>`
      SELECT id FROM space_users WHERE id = ${id} LIMIT 1
    `);
    if (
      row.visibility !== 'public' &&
      present.length === 0 &&
      !isHost(env, row)
    ) {
      throw new MutationError(
        'SPACE_VISIBILITY_DENIED',
        'Not allowed to join this space.'
      );
    }
    if (present.length === 0) {
      await tx.run(sql`
        INSERT INTO space_users (id, space_id, user_id, created_at, created_by_account_id)
        VALUES (${id}, ${spaceId}, ${actorMemberId}, ${env.now().toISOString()}, ${actorAccountId})
        ON CONFLICT (id) DO NOTHING
      `);
    }
    if (isHost(env, row)) {
      await tx.run(sql`
        UPDATE spaces
        SET host_member_id = ${actorMemberId}, host_account_id = ${actorAccountId}
        WHERE id = ${spaceId}
      `);
    }
    await openSession(tx, env, spaceId);
  },
});

export const leaveSpaceMutation = defineMutation({
  name: 'leaveSpace',
  args: spaceIdArgs.extend({ endIfLastSeat: z.boolean().optional() }),
  writes: [SPACES_TABLE.tableName, SPACE_OPEN_SESSIONS_TABLE.tableName],
  async run({ tx, env }, { spaceId, endIfLastSeat }) {
    const row = await getSpaceHost(tx, spaceId);
    if (isHost(env, row) || endIfLastSeat === true) {
      if (!isHost(env, row) && endIfLastSeat === true) {
        throw new MutationError(
          'SPACE_WRITE_DENIED',
          'Not allowed to end this space.'
        );
      }
      await endSpace(tx, env, spaceId);
      return;
    }
    await closeSession(tx, env, spaceId);
  },
});

export const endSpaceMutation = defineMutation({
  name: 'endSpace',
  args: spaceIdArgs,
  writes: [SPACES_TABLE.tableName, SPACE_OPEN_SESSIONS_TABLE.tableName],
  async run({ tx, env }, { spaceId }) {
    await requireHost(tx, env, spaceId, 'Only the host can end this space.');
    await endSpace(tx, env, spaceId);
  },
});

export const renameSpaceMutation = defineMutation({
  name: 'renameSpace',
  args: spaceIdArgs.extend({ title: z.string() }),
  writes: [SPACES_TABLE.tableName],
  async run({ tx, env }, { spaceId, title }) {
    await requireHost(tx, env, spaceId, 'Only the host can rename this space.');
    await tx.run(sql`
      UPDATE spaces
      SET title = ${title.trim() || null},
          host_id = ${env.deviceId},
          host_member_id = ${memberId(env)}
      WHERE id = ${spaceId}
    `);
  },
});

export const setVisibilityMutation = defineMutation({
  name: 'setVisibility',
  args: spaceIdArgs.extend({ visibility: visibilityArgs }),
  writes: [SPACES_TABLE.tableName],
  async run({ tx, env }, { spaceId, visibility }) {
    await requireHost(tx, env, spaceId, 'Only the host can change visibility.');
    if (visibility !== 'private' && env.isAnon) {
      throw new MutationError(
        'SIGN_IN_REQUIRED',
        'Sign in to make a space public.'
      );
    }
    await tx.run(sql`
      UPDATE spaces
      SET visibility = ${visibility},
          host_id = ${env.deviceId},
          host_member_id = ${memberId(env)}
      WHERE id = ${spaceId}
    `);
  },
});

export const addSpaceUserMutation = defineMutation({
  name: 'addSpaceUser',
  args: spaceIdArgs.extend({ userId: z.string().min(1) }),
  writes: [SPACE_USERS_TABLE.tableName],
  async run({ tx, env }, { spaceId, userId }) {
    await requireHost(
      tx,
      env,
      spaceId,
      'Only the host can manage space users.'
    );
    if (userId === env.accountId) {
      throw new MutationError(
        'SPACE_INVALID_INPUT',
        'Host is already a space user.'
      );
    }
    const id = spaceUserEntityId(spaceId, userId);
    await tx.run(sql`
      INSERT INTO space_users (id, space_id, user_id, created_at, created_by_account_id)
      VALUES (${id}, ${spaceId}, ${userId}, ${env.now().toISOString()}, ${accountId(env)})
      ON CONFLICT (id) DO NOTHING
    `);
  },
});

export const removeSpaceUserMutation = defineMutation({
  name: 'removeSpaceUser',
  args: spaceIdArgs.extend({ userId: z.string().min(1) }),
  writes: [SPACE_USERS_TABLE.tableName],
  async run({ tx, env }, { spaceId, userId }) {
    await requireHost(
      tx,
      env,
      spaceId,
      'Only the host can manage space users.'
    );
    await tx.run(sql`
      DELETE FROM space_users WHERE id = ${spaceUserEntityId(spaceId, userId)}
    `);
  },
});

/** Persist that join was announced for this install's open session. */
export const markSpaceJoinAnnouncedMutation = defineMutation({
  name: 'markSpaceJoinAnnounced',
  args: spaceIdArgs,
  writes: [SPACE_OPEN_SESSIONS_TABLE.tableName],
  async run({ tx, env }, { spaceId }) {
    await tx.run(sql`
      UPDATE space_open_sessions
      SET join_announced = ${1}
      WHERE id = ${spaceOpenSessionEntityId(env.deviceId, spaceId)}
        AND join_announced = ${0}
    `);
  },
});

/** Drop open-session rows whose spaces are already ended (orphan cleanup). */
export const closeEndedOpenSessionsMutation = defineMutation({
  name: 'closeEndedOpenSessions',
  args: z.object({}),
  writes: [SPACE_OPEN_SESSIONS_TABLE.tableName],
  async run({ tx }) {
    await tx.run(sql`
      DELETE FROM space_open_sessions
      WHERE space_id IN (SELECT id FROM spaces WHERE ended_at IS NOT NULL)
    `);
  },
});

export const SPACE_MUTATIONS = [
  createSpaceMutation,
  joinSpaceMutation,
  leaveSpaceMutation,
  endSpaceMutation,
  renameSpaceMutation,
  setVisibilityMutation,
  addSpaceUserMutation,
  removeSpaceUserMutation,
  markSpaceJoinAnnouncedMutation,
  closeEndedOpenSessionsMutation,
] as const;
