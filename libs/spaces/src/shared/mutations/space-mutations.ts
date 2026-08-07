import { roomTopic, userTopic } from '@libs/db/shared/sync-topics';
import {
  resolveSpaceMemberId,
  spaceOpenSessionEntityId,
  spaceUserEntityId,
} from '@libs/spaces/shared/participation/participation-ids';
import { isSpaceHostActor } from '@libs/spaces/shared/participation/space-participation-policy';
import { SPACE_VISIBILITIES } from '@libs/spaces/shared/space-visibility';
import { sql } from '@pkgs/sql';
import {
  defineMutation,
  type MutationDb,
  type MutationEnv,
  MutationError,
} from '@pkgs/sync-engine/shared';
import { z } from 'zod';

function spaceActorInvalidates(spaceId: string, env: MutationEnv) {
  return [roomTopic(spaceId), userTopic(env.actorId)];
}

function addUserTopic(
  topics: Set<ReturnType<typeof userTopic>>,
  id: string | null | undefined
): void {
  if (id === null || id === undefined || id.length === 0) return;
  topics.add(userTopic(id));
}

async function loadSpacePartyUserIds(
  db: MutationDb,
  spaceId: string
): Promise<string[]> {
  const members = await db.query(sql<{ readonly user_id: string }>`
    SELECT DISTINCT user_id FROM space_users
    WHERE space_id = ${spaceId} AND _deleted_at IS NULL
  `);
  const hosts = await db.query(sql<{
    readonly host_member_id: string | null;
    readonly host_account_id: string | null;
  }>`
    SELECT host_member_id, host_account_id FROM spaces
    WHERE id = ${spaceId}
    LIMIT 1
  `);
  const host = hosts[0];
  return [
    ...members.map((row) => row.user_id),
    host?.host_member_id ?? '',
    host?.host_account_id ?? '',
  ];
}

/**
 * Room + actor + every space_users member (and host ids). Peers only subscribe
 * to `user:{self}` for openSpaceSessions; without their user topic they wait
 * for reconcile after end/leave/join.
 */
async function spacePartyInvalidates(
  spaceId: string,
  env: MutationEnv,
  db?: MutationDb
) {
  const topics = new Set(spaceActorInvalidates(spaceId, env));
  if (db === undefined) return [...topics];
  const ids = await loadSpacePartyUserIds(db, spaceId);
  for (const id of ids) addUserTopic(topics, id);
  return [...topics];
}

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
  spaceId: string,
  joinAnnounced: 0 | 1 = 0
): Promise<void> {
  const id = spaceOpenSessionEntityId(env.deviceId, spaceId);
  const now = env.now().toISOString();
  // Single upsert — skip pre-SELECT (saves a remote Postgres RTT).
  await tx.run(sql`
    INSERT INTO space_open_sessions (
      id, space_id, device_id, opened_at, join_announced, _deleted_at
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
      _deleted_at = NULL,
      opened_at = excluded.opened_at,
      join_announced = excluded.join_announced,
      space_id = excluded.space_id,
      device_id = excluded.device_id
  `);
}

async function closeSession(
  tx: MutationDb,
  env: MutationEnv,
  spaceId: string
): Promise<void> {
  const now = env.now().toISOString();
  await tx.run(sql`
    UPDATE space_open_sessions
    SET _deleted_at = ${now}
    WHERE id = ${spaceOpenSessionEntityId(env.deviceId, spaceId)}
      AND _deleted_at IS NULL
  `);
}

async function endSpace(
  tx: MutationDb,
  env: MutationEnv,
  spaceId: string
): Promise<void> {
  const actorAccountId = accountId(env);
  const now = env.now().toISOString();
  await tx.run(sql`
    UPDATE spaces
    SET ended_at = ${now},
        host_id = ${env.deviceId},
        host_member_id = ${memberId(env)},
        host_account_id = ${actorAccountId}
    WHERE id = ${spaceId} AND ended_at IS NULL
  `);
  await tx.run(sql`
    UPDATE space_open_sessions
    SET _deleted_at = ${now}
    WHERE space_id = ${spaceId} AND _deleted_at IS NULL
  `);
  await tx.run(sql`
    UPDATE space_open_sessions
    SET _deleted_at = ${now}
    WHERE _deleted_at IS NULL
      AND space_id IN (SELECT id FROM spaces WHERE ended_at IS NOT NULL)
  `);
}

export const createSpaceMutation = defineMutation({
  name: 'createSpace',
  args: z.object({ spaceId: z.string().min(1), visibility: visibilityArgs }),
  declaredWrites: ['spaces', 'space_users', 'space_open_sessions'],
  // Host-only at create — skip party DB lookup (was ~700ms on remote Postgres).
  invalidates: ({ spaceId }, env) => spaceActorInvalidates(spaceId, env),
  affectedRows: ({ spaceId }, env) => ({
    spaces: [spaceId],
    space_users: [spaceUserEntityId(spaceId, env.accountId ?? env.actorId)],
    space_open_sessions: [spaceOpenSessionEntityId(env.deviceId, spaceId)],
  }),
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
      INSERT INTO space_users (
        id, space_id, user_id, created_at, created_by_account_id, _deleted_at
      )
      VALUES (
        ${spaceUserEntityId(spaceId, actorMemberId)}, ${spaceId},
        ${actorMemberId}, ${now}, ${actorAccountId}, ${null}
      )
      ON CONFLICT (id) DO UPDATE SET
        _deleted_at = NULL,
        created_at = excluded.created_at,
        created_by_account_id = excluded.created_by_account_id
    `);
    await openSession(tx, env, spaceId, 1);
  },
});

export const joinSpaceMutation = defineMutation({
  name: 'joinSpace',
  args: spaceIdArgs,
  declaredWrites: ['space_users', 'space_open_sessions'],
  invalidates: ({ spaceId }, env, db) =>
    spacePartyInvalidates(spaceId, env, db),
  affectedRows: ({ spaceId }, env) => ({
    space_users: [spaceUserEntityId(spaceId, env.accountId ?? env.actorId)],
    space_open_sessions: [spaceOpenSessionEntityId(env.deviceId, spaceId)],
    spaces: [spaceId],
  }),
  async run({ tx, env }, { spaceId }) {
    const actorAccountId = accountId(env);
    const row = await getSpaceHost(tx, spaceId);
    if (row.ended_at !== null) {
      throw new MutationError('SPACE_ENDED', 'This space has ended.');
    }
    const actorMemberId = memberId(env);
    const id = spaceUserEntityId(spaceId, actorMemberId);
    const present = await tx.query(sql<{ readonly id: string }>`
      SELECT id FROM space_users
      WHERE id = ${id} AND _deleted_at IS NULL
      LIMIT 1
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
      const now = env.now().toISOString();
      await tx.run(sql`
        INSERT INTO space_users (
          id, space_id, user_id, created_at, created_by_account_id, _deleted_at
        )
        VALUES (
          ${id}, ${spaceId}, ${actorMemberId}, ${now}, ${actorAccountId}, ${null}
        )
        ON CONFLICT (id) DO UPDATE SET
          _deleted_at = NULL,
          created_at = excluded.created_at,
          created_by_account_id = excluded.created_by_account_id
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
  declaredWrites: ['spaces', 'space_open_sessions'],
  invalidates: ({ spaceId }, env, db) =>
    spacePartyInvalidates(spaceId, env, db),
  affectedRows: ({ spaceId }, env) => ({
    spaces: [spaceId],
    space_open_sessions: [spaceOpenSessionEntityId(env.deviceId, spaceId)],
  }),
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
  declaredWrites: ['spaces', 'space_open_sessions'],
  invalidates: ({ spaceId }, env, db) =>
    spacePartyInvalidates(spaceId, env, db),
  // Session tombstones are multi-row; space `ended_at` is the peer-visible signal.
  affectedRows: ({ spaceId }) => ({ spaces: [spaceId] }),
  async run({ tx, env }, { spaceId }) {
    await requireHost(tx, env, spaceId, 'Only the host can end this space.');
    await endSpace(tx, env, spaceId);
  },
});

export const renameSpaceMutation = defineMutation({
  name: 'renameSpace',
  args: spaceIdArgs.extend({ title: z.string() }),
  declaredWrites: ['spaces'],
  invalidates: ({ spaceId }, env, db) =>
    spacePartyInvalidates(spaceId, env, db),
  affectedRows: ({ spaceId }) => ({ spaces: [spaceId] }),
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
  declaredWrites: ['spaces'],
  invalidates: ({ spaceId }, env, db) =>
    spacePartyInvalidates(spaceId, env, db),
  affectedRows: ({ spaceId }) => ({ spaces: [spaceId] }),
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
  declaredWrites: ['space_users'],
  invalidates: ({ spaceId, userId }, env) => [
    ...spaceActorInvalidates(spaceId, env),
    userTopic(userId),
  ],
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
    const now = env.now().toISOString();
    await tx.run(sql`
      INSERT INTO space_users (
        id, space_id, user_id, created_at, created_by_account_id, _deleted_at
      )
      VALUES (${id}, ${spaceId}, ${userId}, ${now}, ${accountId(env)}, ${null})
      ON CONFLICT (id) DO UPDATE SET
        _deleted_at = NULL,
        created_at = excluded.created_at,
        created_by_account_id = excluded.created_by_account_id
    `);
  },
});

export const removeSpaceUserMutation = defineMutation({
  name: 'removeSpaceUser',
  args: spaceIdArgs.extend({ userId: z.string().min(1) }),
  declaredWrites: ['space_users'],
  invalidates: ({ spaceId, userId }, env) => [
    ...spaceActorInvalidates(spaceId, env),
    userTopic(userId),
  ],
  async run({ tx, env }, { spaceId, userId }) {
    await requireHost(
      tx,
      env,
      spaceId,
      'Only the host can manage space users.'
    );
    await tx.run(sql`
      UPDATE space_users
      SET _deleted_at = ${env.now().toISOString()}
      WHERE id = ${spaceUserEntityId(spaceId, userId)}
        AND _deleted_at IS NULL
    `);
  },
});

/** Persist that join was announced for this install's open session. */
export const markSpaceJoinAnnouncedMutation = defineMutation({
  name: 'markSpaceJoinAnnounced',
  args: spaceIdArgs,
  declaredWrites: ['space_open_sessions'],
  invalidates: (_args, env) => [userTopic(env.actorId)],
  async run({ tx, env }, { spaceId }) {
    await tx.run(sql`
      UPDATE space_open_sessions
      SET join_announced = ${1}
      WHERE id = ${spaceOpenSessionEntityId(env.deviceId, spaceId)}
        AND join_announced = ${0}
        AND _deleted_at IS NULL
    `);
  },
});

/** Soft-close open-session rows whose spaces are already ended (orphan cleanup). */
export const closeEndedOpenSessionsMutation = defineMutation({
  name: 'closeEndedOpenSessions',
  args: z.object({}),
  declaredWrites: ['space_open_sessions'],
  invalidates: (_args, env) => [userTopic(env.actorId)],
  async run({ tx, env }) {
    await tx.run(sql`
      UPDATE space_open_sessions
      SET _deleted_at = ${env.now().toISOString()}
      WHERE _deleted_at IS NULL
        AND space_id IN (SELECT id FROM spaces WHERE ended_at IS NOT NULL)
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
