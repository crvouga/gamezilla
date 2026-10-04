import sql from '@pkgs/sql-root-shared/sql';
import { defineMutation } from '@pkgs/sync-engine-shared/define-mutation';
import { spaceOpenSessionEntityId } from './participation-ids';
import { spaceIdArgs } from './space-mutation-helpers';
export const markSpaceJoinAnnouncedMutation = defineMutation({
  name: 'markSpaceJoinAnnounced',
  args: spaceIdArgs,
  async run({ tx, env }, { spaceId }) {
    await tx.run(sql`
      UPDATE spaces_open_sessions
      SET join_announced = ${true}
      WHERE id = ${spaceOpenSessionEntityId(env.deviceId, spaceId)}
        AND join_announced = ${false}
        AND deleted_at IS NULL
    `);
  },
});
