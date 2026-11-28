import sql from '@pkgs/sql-root-shared-ts/sql';
import { defineMutation } from '@pkgs/sync-engine-shared-ts/define-mutation';
import { z } from 'zod';

import { avatarConfigArg, avatarConfigJson } from './avatar-mutation-argument';

export const patchAvatarMutation = defineMutation({
  name: 'patchAvatar',
  args: z.object({ avatarConfig: avatarConfigArg }),
  async run({ tx, env }, { avatarConfig }) {
    await tx.run(sql`
      UPDATE profile
      SET avatar_config = ${avatarConfigJson(avatarConfig)}
      WHERE id = ${env.actorId}
    `);
  },
});
