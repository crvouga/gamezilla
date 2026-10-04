import sql from '@pkgs/sql-shared/sql';
import { defineMutation } from '@pkgs/sync-engine-shared/define-mutation';
import { MutationError } from '@pkgs/sync-engine-shared/mutations-types';
import { z } from 'zod';

import {
  parseAvatarConfig,
  serializeAvatarConfig,
} from './avatar-config';

const avatarConfigArgs = z.union([
  z.string(),
  z.record(z.string(), z.unknown()),
]);

function avatarConfigJson(value: z.infer<typeof avatarConfigArgs>): string {
  const avatarConfig = parseAvatarConfig(value);
  if (avatarConfig === null) {
    throw new MutationError(
      'INVALID_AVATAR_CONFIG',
      'Avatar configuration is invalid.'
    );
  }
  return serializeAvatarConfig(avatarConfig);
}

export const patchAvatarMutation = defineMutation({
  name: 'patchAvatar',
  args: z.object({ avatarConfig: avatarConfigArgs }),
  async run({ tx, env }, { avatarConfig }) {
    await tx.run(sql`
      UPDATE profile
      SET avatar_config = ${avatarConfigJson(avatarConfig)}
      WHERE id = ${env.actorId}
    `);
  },
});
