import { PERMISSION } from '@libs/permissions-shared/permission-catalog';
import sql from '@pkgs/sql-root-shared/sql';
import { defineMutation } from '@pkgs/sync-engine-shared/define-mutation';
import { MutationError } from '@pkgs/sync-engine-shared/mutations-types';
import { z } from 'zod';

import { spaceUserEntityId } from './participation-ids';
import {
  closeSession,
  endSpace,
  getSpaceHost,
  isHost,
  memberId,
  requireSpacePermission,
  spaceIdArgs,
} from './space-mutation-helpers';
import { changeSpaceRoomMembership } from './space-withdrawal';
import { playerLeftEvent } from './telemetry';
export const leaveSpaceMutation = defineMutation({
  name: 'leaveSpace',
  args: spaceIdArgs.extend({ endIfLastSeat: z.boolean().optional() }),
  async run({ tx, env }, { spaceId, endIfLastSeat }) {
    await requireSpacePermission(tx, env, {
      spaceId,
      permission: PERMISSION.spacesLeave,
      message: 'You are not in this space.',
    });
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
    const now = env.now().toISOString();
    const actorMemberId = memberId(env);
    const membershipEventId = await changeSpaceRoomMembership(
      { tx, env },
      spaceId,
      'left',
      actorMemberId
    );
    await tx.run(sql`
      UPDATE spaces_users
      SET deleted_at = ${now}, joined = ${false},
        participation_revision = participation_revision + 1
      WHERE id = ${spaceUserEntityId(spaceId, actorMemberId)}
        AND deleted_at IS NULL
    `);
    await closeSession(tx, env, spaceId);
    await playerLeftEvent.record(
      { tx, env },
      {
        id: membershipEventId,
        attributes: { 'space.id': spaceId, 'subject.id': env.actorId },
      }
    );
  },
});
