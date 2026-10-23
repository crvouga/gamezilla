import sql from '@pkgs/sql-root-shared-ts/sql';
import { defineMutation } from '@pkgs/sync-engine-shared-ts/define-mutation';
import { MutationError } from '@pkgs/sync-engine-shared-ts/mutations-types';
import { areFriends } from './friendship-sql';
import { spaceUserEntityId } from './participation-ids';
import {
  getSpaceHost,
  isHost,
  memberId,
  openSession,
  spaceIdArgs,
} from './space-mutation-helpers';
import { changeSpaceRoomMembership } from './space-withdrawal';
import { playerJoinedEvent } from './telemetry';
export const joinSpaceMutation = defineMutation({
  name: 'joinSpace',
  args: spaceIdArgs,
  pendingUx: 'pending',
  async run({ tx, env }, { spaceId }) {
    const actorAccountId = env.accountId;
    const row = await getSpaceHost(tx, spaceId);
    if (row.ended_at !== null) {
      throw new MutationError('SPACE_ENDED', 'This space has ended.');
    }
    const actorMemberId = memberId(env);
    const id = spaceUserEntityId(spaceId, actorMemberId);
    const present = await tx.query(sql<{ readonly id: string }>`
      SELECT id FROM spaces_users
      WHERE id = ${id} AND deleted_at IS NULL
      LIMIT 1
    `);
    if (
      row.visibility !== 'public' &&
      present.length === 0 &&
      !isHost(env, row) &&
      !(await areFriends(tx, {
        viewerMemberId: actorMemberId,
        hostAccountId: row.host_account_id,
        hostMemberId: row.host_member_id,
      }))
    ) {
      throw new MutationError(
        'SPACE_VISIBILITY_DENIED',
        'Not allowed to join this space.'
      );
    }
    if (present.length === 0) {
      const now = env.now().toISOString();
      await tx.run(sql`
        INSERT INTO spaces_users (
          id, space_id, user_id, created_at, created_by_account_id, joined, participation_revision, deleted_at
        )
        VALUES (
          ${id}, ${spaceId}, ${actorMemberId}, ${now}, ${actorAccountId}, ${true}, ${0}, ${null}
        )
        ON CONFLICT (id) DO UPDATE SET
          deleted_at = NULL,
          joined = ${true},
          created_at = excluded.created_at,
          created_by_account_id = excluded.created_by_account_id
      `);
    }
    await tx.run(
      sql`UPDATE spaces_users SET joined = ${true} WHERE id = ${id} AND deleted_at IS NULL`
    );
    if (
      isHost(env, row) &&
      (row.host_member_id !== actorMemberId ||
        row.host_account_id !== actorAccountId)
    ) {
      await tx.run(sql`
        UPDATE spaces
        SET host_member_id = ${actorMemberId}, host_account_id = ${actorAccountId}
        WHERE id = ${spaceId}
      `);
    }
    const membershipEventId = await changeSpaceRoomMembership(
      { tx, env },
      spaceId,
      'joined',
      actorMemberId
    );
    await openSession(tx, env, spaceId);
    if (present.length === 0)
      await playerJoinedEvent.record(
        { tx, env },
        {
          id: membershipEventId,
          attributes: { 'space.id': spaceId, 'subject.id': env.actorId },
        }
      );
  },
});
